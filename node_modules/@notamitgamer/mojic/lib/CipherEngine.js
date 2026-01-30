import crypto from 'crypto';
import { Transform } from 'stream';
import { StringDecoder } from 'string_decoder';

/**
 * MOJIC v1.2.5 CIPHER ENGINE
 * "Operation Polymorphic Chaos"
 * * Fixes:
 * - Word Boundaries: Prevents splitting variables like 'secretCode'
 * - Regex: correctly handles #directives vs keywords
 * - Tokenization: Handles combined graphemes (skin tones/modifiers) during decryption
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
    return universe; // Expect > 1100 chars
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

// --- PRNG: Xoshiro256** ---
class Xoshiro256 {
    constructor(seedBuffer) {
        if (seedBuffer.length < 32) throw new Error("Seed too short");
        this.s = [
            seedBuffer.readBigUInt64BE(0),
            seedBuffer.readBigUInt64BE(8),
            seedBuffer.readBigUInt64BE(16),
            seedBuffer.readBigUInt64BE(24)
        ];
    }

    next() {
        const result = this.rotl(this.s[1] * 5n, 7n) * 9n;
        const t = this.s[1] << 17n;

        this.s[2] ^= this.s[0];
        this.s[3] ^= this.s[1];
        this.s[1] ^= this.s[2];
        this.s[0] ^= this.s[3];

        this.s[2] ^= t;
        this.s[3] = this.rotl(this.s[3], 45n);

        return result; 
    }

    nextFloat() {
        const val = Number(this.next() >> 11n);
        return val * (2 ** -53); 
    }

    rotl(x, k) {
        return (x << k) | (x >> (64n - k));
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
        this.lineLength = 0; // For wrapping
    }

    async init(existingSaltHex = null, expectedAuthCheck = null) {
        this.salt = existingSaltHex 
            ? Buffer.from(existingSaltHex, 'hex') 
            : crypto.randomBytes(16);

        const derivedKey = await new Promise((resolve, reject) => {
            crypto.pbkdf2(this.password, this.salt, 100000, 64, 'sha512', (err, key) => {
                if (err) reject(err); else resolve(key);
            });
        });

        const seedBuffer = derivedKey.subarray(0, 32);
        this.authKey = derivedKey.subarray(32, 64);
        
        // Check password correctness immediately if Auth Check is provided
        if (expectedAuthCheck) {
            const calculatedAuthCheck = this.authKey.subarray(0, 4).toString('hex');
            if (calculatedAuthCheck !== expectedAuthCheck) {
                throw new Error("WRONG_PASSWORD");
            }
        }

        this.rng = new Xoshiro256(seedBuffer);

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
        
        return { 
            saltHex: hexString.substring(0, 32),
            authCheckHex: hexString.length >= 40 ? hexString.substring(32, 40) : null
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
                
                // Separate alpha keywords (int, void) from symbols (#include)
                const alphaKeywords = C_KEYWORDS.filter(k => /^\w+$/.test(k)).sort((a,b)=>b.length-a.length).join('|');
                const symKeywords = C_KEYWORDS.filter(k => !/^\w+$/.test(k)).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                
                // Match: \b(int|void)\b  OR  (#include)
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
                            
                            const enc = engine._encodeBase1024(chunk);
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
                    const enc = engine._encodeBase1024(padded);
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
        const enc = this._encodeBase1024(padded);
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
                    if (segment.match(/\s/)) continue; // Skip wraps

                    // FIX: Some emojis in the universe (like skin tones 0x1F3FB) are modifiers.
                    // If they appear next to another emoji, Intl.Segmenter merges them.
                    // We must split them back into atomic code points to preserve token count.
                    const atoms = [...segment];

                    for (const atom of atoms) {
                        emojiBuffer.push(atom);
                        
                        if (emojiBuffer.length > FOOTER_LEN) {
                            const emo = emojiBuffer.shift();
                            engine._processDecryptToken(emo, this);
                            // Feed actual atomic tokens to HMAC to match encryption
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
            
            // Safety: This buffer should be empty if the stream is synced.
            if (this.decodeDataBuf.length > 0) {
                this.decodeDataBuf = [];
            }
            
            stream.push(keyword);

        } else if (this.dataReverseMap.has(emo)) {
            this.decodeDataBuf.push(this.dataReverseMap.get(emo));
            if (this.decodeDataBuf.length === 4) {
                const chunk = this._decodeBase1024(this.decodeDataBuf);
                this.decodeDataBuf = [];
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