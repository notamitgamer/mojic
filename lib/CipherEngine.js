import crypto from 'crypto';
import { Transform } from 'stream';
import { StringDecoder } from 'string_decoder';

/**
 * MOJIC v2.1.2 CIPHER ENGINE
 * "Operation Ironclad"
 * * Security Upgrades:
 * - KDF: Upgraded from PBKDF2 to Scrypt (Memory-Hard, GPU-Resistant)
 * - PRNG: Upgraded from Xoshiro256** to AES-256-CTR (Cryptographically Secure)
 * - Auth: Extended Key material for higher entropy
 * * Fixes:
 * - Polymorphic Data: Added XOR Whitening to raw data chunks to hide patterns (e.g., repeating whitespace).
 * - RNG Buffering: Fixed potential byte loss in AES-CTR buffer refill.
 */

// --- EMOJI UNIVERSE GENERATION ---
const HEADER_ALPHABET = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗'];

const generateUniverse = () => {
    const universe = [];
    const ranges = [
        [0x1F600, 0x1F64F], // Emoticons
        [0x1F300, 0x1F5FF], // Misc Symbols (Contains modifiers)
        [0x1F680, 0x1F6FF], // Transport
        [0x1F900, 0x1F9FF]  // Supplemental
    ];

    const headerSet = new Set(HEADER_ALPHABET);

    for (const [start, end] of ranges) {
        for (let code = start; code <= end; code++) {
            const char = String.fromCodePoint(code);
            if (!headerSet.has(char)) {
                universe.push(char);
            }
        }
    }
    return universe; 
};

const RAW_UNIVERSE = generateUniverse();

if (RAW_UNIVERSE.length < 1080) {
    throw new Error("Critical: Emoji Universe generation failed to produce enough tokens.");
}

const C_KEYWORDS = [
    'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
    'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if',
    'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof', 'static',
    'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while',
    'include', 'define', 'main', 'printf', 'NULL', '#include', '#define'
];

// --- PRNG: AES-256-CTR (CSPRNG) ---
// Replaces Xoshiro with a cryptographically secure stream
class AesCounterRNG {
    constructor(key, iv) {
        if (key.length !== 32 || iv.length !== 16) throw new Error("Invalid seed length for AES-RNG");
        this.cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
        this.buffer = Buffer.alloc(0);
        
        // Encrypt an initial block of zeros to start the keystream
        this._refill();
    }

    _refill() {
        // Generate 1KB of random keystream at a time
        const zeros = Buffer.alloc(1024); 
        const newBytes = this.cipher.update(zeros);
        // Correctly concatenate new bytes to existing buffer to prevent data loss
        this.buffer = Buffer.concat([this.buffer, newBytes]);
    }

    next() {
        if (this.buffer.length < 8) this._refill();
        
        // Read 64 bits (BigInt) to match previous interface
        const val = this.buffer.readBigUInt64BE(0);
        this.buffer = this.buffer.subarray(8);
        return val;
    }

    nextBytes(length) {
        if (this.buffer.length < length) this._refill();
        
        // Return a Buffer of requested length
        const bytes = this.buffer.subarray(0, length);
        this.buffer = this.buffer.subarray(length);
        return bytes;
    }

    nextFloat() {
        // Convert uint64 to double [0, 1)
        // We take upper 53 bits for standard double precision
        const val = Number(this.next() >> 11n);
        return val * (2 ** -53); 
    }
}

export class CipherEngine {
    constructor(password) {
        this.password = password;
        this.keywordMap = new Map(); 
        this.keywordReverseMap = new Map(); 
        this.dataAlphabet = []; 
        this.dataReverseMap = new Map(); 
        this.isReady = false;
        this.hmac = null; 
        this.lineLength = 0;
    }

    async init(existingSaltHex = null, expectedAuthCheck = null) {
        this.salt = existingSaltHex 
            ? Buffer.from(existingSaltHex, 'hex') 
            : crypto.randomBytes(32); // Increased salt size to 32 bytes

        // SECURITY UPGRADE: Scrypt instead of PBKDF2
        // N=16384, r=8, p=1 are standard secure defaults
        const derivedKey = await new Promise((resolve, reject) => {
            crypto.scrypt(this.password, this.salt, 80, { N: 16384, r: 8, p: 1 }, (err, key) => {
                if (err) reject(err); else resolve(key);
            });
        });

        // Split 80 bytes of key material:
        // 0-32:   AES Key (32 bytes)
        // 32-48:  AES IV (16 bytes)
        // 48-80:  HMAC Auth Key (32 bytes)
        
        const rngKey = derivedKey.subarray(0, 32);
        const rngIv = derivedKey.subarray(32, 48);
        this.authKey = derivedKey.subarray(48, 80);
        
        if (expectedAuthCheck) {
            const calculatedAuthCheck = this.authKey.subarray(0, 4).toString('hex');
            if (calculatedAuthCheck !== expectedAuthCheck) {
                throw new Error("WRONG_PASSWORD");
            }
        }

        // Initialize CSPRNG
        this.rng = new AesCounterRNG(rngKey, rngIv);

        const shuffled = this._shuffleArray([...RAW_UNIVERSE]);

        let ptr = 0;
        this.keywordEmojis = [];
        for (const kw of C_KEYWORDS) {
            const emo = shuffled[ptr++];
            this.keywordEmojis.push(emo); 
            this.keywordMap.set(kw, emo); 
            this.keywordReverseMap.set(emo, kw);
        }

        this.dataAlphabet = shuffled.slice(ptr, ptr + 1024);
        if (this.dataAlphabet.length < 1024) throw new Error("Not enough emojis for Base-1024");
        
        this.dataAlphabet.forEach((emo, idx) => {
            this.dataReverseMap.set(emo, idx);
        });

        this.hmac = crypto.createHmac('sha256', this.authKey);
        this.isReady = true;
    }

    _shuffleArray(array) {
        // Fisher-Yates shuffle using CSPRNG
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(this.rng.nextFloat() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    _encodeHeader() {
        const saltHex = this.salt.toString('hex');
        const authCheck = this.authKey.subarray(0, 4).toString('hex'); 
        
        let headerStr = '';
        for (const char of (saltHex + authCheck)) {
            const val = parseInt(char, 16);
            headerStr += HEADER_ALPHABET[val];
        }
        return headerStr + '\n';
    }

    static decodeHeader(headerStr) {
        let hexString = '';
        const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
        const segments = segmenter.segment(headerStr.trim());

        for (const { segment } of segments) {
            const index = HEADER_ALPHABET.indexOf(segment);
            if (index === -1) throw new Error("Invalid Header format.");
            hexString += index.toString(16);
        }
        
        // Salt is now variable length (usually 32 bytes = 64 hex chars), 
        // AuthCheck is always last 4 bytes (8 hex chars)
        const totalLen = hexString.length;
        if (totalLen < 8) throw new Error("Header too short");

        const authStart = totalLen - 8;
        
        return { 
            saltHex: hexString.substring(0, authStart),
            authCheckHex: hexString.substring(authStart)
        };
    }

    // --- STREAMING ENCRYPTION ---

    getEncryptStream() {
        if (!this.isReady) throw new Error("Engine not initialized");
        const engine = this;
        let buffer = Buffer.alloc(0); 
        
        return new Transform({
            transform(chunk, encoding, callback) {
                const str = chunk.toString('utf8');
                
                const alphaKeywords = C_KEYWORDS.filter(k => /^\w+$/.test(k)).sort((a,b)=>b.length-a.length).join('|');
                const symKeywords = C_KEYWORDS.filter(k => !/^\w+$/.test(k)).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                
                const regex = new RegExp(`(\\b(?:${alphaKeywords})\\b|(?:${symKeywords}))`, 'g');
                
                const parts = str.split(regex); 
                
                for (const part of parts) {
                    if (!part) continue;

                    if (C_KEYWORDS.includes(part)) {
                        if (buffer.length > 0) {
                            this.push(engine._flushDataBuffer(buffer));
                            buffer = Buffer.alloc(0);
                        }

                        const baseIdx = engine.keywordEmojis.indexOf(engine.keywordMap.get(part));
                        const shift = Number(engine.rng.next() % BigInt(engine.keywordEmojis.length));
                        const newIdx = (baseIdx + shift) % engine.keywordEmojis.length;
                        const polyEmoji = engine.keywordEmojis[newIdx];
                        
                        const outBuf = Buffer.from(polyEmoji);
                        engine.hmac.update(outBuf);
                        this.push(engine._wrapOutput(outBuf));

                    } else {
                        buffer = Buffer.concat([buffer, Buffer.from(part, 'utf8')]);
                        
                        while (buffer.length >= 5) {
                            const chunk = buffer.subarray(0, 5);
                            buffer = buffer.subarray(5);
                            
                            // XOR Whitening: Hide patterns (like spaces) by XORing with RNG stream
                            const mask = engine.rng.nextBytes(5);
                            const maskedChunk = Buffer.alloc(5);
                            for(let i=0; i<5; i++) maskedChunk[i] = chunk[i] ^ mask[i];

                            const enc = engine._encodeBase1024(maskedChunk);
                            engine.hmac.update(enc);
                            this.push(engine._wrapOutput(enc));
                        }
                    }
                }
                callback();
            },
            
            flush(callback) {
                if (buffer.length > 0) {
                    const padded = Buffer.alloc(5);
                    buffer.copy(padded);
                    
                    // XOR Whitening for final block
                    const mask = engine.rng.nextBytes(5);
                    const maskedChunk = Buffer.alloc(5);
                    for(let i=0; i<5; i++) maskedChunk[i] = padded[i] ^ mask[i];

                    const enc = engine._encodeBase1024(maskedChunk);
                    engine.hmac.update(enc);
                    this.push(engine._wrapOutput(enc));
                }

                const digest = engine.hmac.digest(); 
                let footerStr = '';
                for (const byte of digest) {
                    const hex = byte.toString(16).padStart(2, '0');
                    for (const char of hex) {
                        const val = parseInt(char, 16);
                        footerStr += HEADER_ALPHABET[val];
                    }
                }
                this.push(Buffer.from('\n' + footerStr));
                callback();
            }
        });
    }

    _wrapOutput(bufferChunk) {
        this.lineLength += bufferChunk.length;
        if (this.lineLength > 300) { 
            this.lineLength = 0;
            return Buffer.concat([bufferChunk, Buffer.from('\n')]);
        }
        return bufferChunk;
    }

    _encodeBase1024(buffer5) {
        let val = 0n;
        for (let i = 0; i < 5; i++) {
            val += BigInt(buffer5[i]) * (256n ** BigInt(i));
        }
        
        let output = '';
        for (let i = 0; i < 4; i++) {
            const idx = Number(val % 1024n);
            val = val / 1024n;
            output += this.dataAlphabet[idx];
        }
        return Buffer.from(output);
    }

    _flushDataBuffer(buf) {
        if (buf.length === 0) return Buffer.alloc(0);
        const padded = Buffer.alloc(5);
        buf.copy(padded);

        // XOR Whitening
        const mask = this.rng.nextBytes(5);
        const maskedChunk = Buffer.alloc(5);
        for(let i=0; i<5; i++) maskedChunk[i] = padded[i] ^ mask[i];

        const enc = this._encodeBase1024(maskedChunk);
        this.hmac.update(enc);
        return this._wrapOutput(enc);
    }

    // --- STREAMING DECRYPTION ---

    getDecryptStream() {
        if (!this.isReady) throw new Error("Engine not initialized");
        const engine = this;
        const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
        
        const FOOTER_LEN = 64; 
        let emojiBuffer = []; 

        return new Transform({
            transform(chunk, encoding, callback) {
                const str = chunk.toString('utf8');
                const segments = [...segmenter.segment(str)];
                
                for (const { segment } of segments) {
                    if (segment.match(/\s/)) continue; 

                    const atoms = [...segment];

                    for (const atom of atoms) {
                        emojiBuffer.push(atom);
                        
                        if (emojiBuffer.length > FOOTER_LEN) {
                            const emo = emojiBuffer.shift();
                            engine._processDecryptToken(emo, this);
                            engine.hmac.update(Buffer.from(emo));
                        }
                    }
                }
                callback();
            },
            
            flush(callback) {
                if (emojiBuffer.length !== FOOTER_LEN) {
                    this.emit('error', new Error("File corrupted or truncated (No Footer)"));
                    return;
                }

                const footerStr = emojiBuffer.join('');
                const calcDigest = engine.hmac.digest('hex'); 
                
                let footerHex = '';
                try {
                    for (const char of footerStr) {
                        const idx = HEADER_ALPHABET.indexOf(char);
                        if (idx === -1) throw new Error();
                        footerHex += idx.toString(16);
                    }
                } catch (e) {
                    this.emit('error', new Error("Invalid Integrity Seal"));
                    return;
                }

                if (footerHex !== calcDigest) {
                    this.emit('error', new Error("FILE_TAMPERED"));
                    return;
                }
                callback();
            }
        });
    }

    decodeDataBuf = []; 

    _processDecryptToken(emo, stream) {
        if (this.keywordReverseMap.has(emo)) {
            const currentR = Number(this.rng.next() % BigInt(this.keywordEmojis.length));
            const emoIdx = this.keywordEmojis.indexOf(emo);
            
            let baseIdx = (emoIdx - currentR) % this.keywordEmojis.length;
            if (baseIdx < 0) baseIdx += this.keywordEmojis.length;
            
            const originalEmo = this.keywordEmojis[baseIdx];
            const keyword = this.keywordReverseMap.get(originalEmo);
            
            if (this.decodeDataBuf.length > 0) {
                this.decodeDataBuf = [];
            }
            
            stream.push(keyword);

        } else if (this.dataReverseMap.has(emo)) {
            this.decodeDataBuf.push(this.dataReverseMap.get(emo));
            if (this.decodeDataBuf.length === 4) {
                // We have a full encoded chunk (4 emojis)
                const maskedChunk = this._decodeBase1024(this.decodeDataBuf);
                this.decodeDataBuf = [];
                
                // Get mask from RNG (Synchronized with encryption)
                const mask = this.rng.nextBytes(5);
                const chunk = Buffer.alloc(5);
                
                // XOR Back to get plaintext
                for(let i=0; i<5; i++) chunk[i] = maskedChunk[i] ^ mask[i];

                const cleanChunk = chunk.filter(b => b !== 0x00);
                stream.push(cleanChunk);
            }
        }
    }

    _decodeBase1024(indices) {
        let val = 0n;
        for (let i = 3; i >= 0; i--) {
            val = (val * 1024n) + BigInt(indices[i]);
        }
        
        const buf = Buffer.alloc(5);
        for (let i = 0; i < 5; i++) {
            buf[i] = Number(val % 256n);
            val = val / 256n;
        }
        return buf;
    }
}