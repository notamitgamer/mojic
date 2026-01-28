import crypto from 'crypto';
import { Transform } from 'stream';
import { StringDecoder } from 'string_decoder';

/**
 * Emojic CipherEngine
 * Handles the logic for mapping C-code to Emojis based on a password seed.
 * * * Updates:
 * - Uses Intl.Segmenter for robust Emoji/Grapheme decoding.
 * - Implements 'tail buffering' in streams to prevent splitting multi-codepoint emojis.
 */

const HEADER_ALPHABET = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗'];

const EMOJI_UNIVERSE = [
    '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
    '😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔',
    '🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷',
    '🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐','😕',
    '😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱',
    '😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩',
    '🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾',
    '🙈','🙉','🙊','💋','💌','💘','💝','💖','💗','💓','💞','💕','💟','❣️','💔','❤️',
    '🧡','💛','💚','💙','💜','🤎','🖤','🤍','💯','💢','💥','💫','💦','💨','🕳️','💣',
    '💬','👁️','💭','💤','👋','🤚','🖐️','✋','🖖','👌','🤏','✌️','🤞','🤟','🤘',
    '🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐',
    '🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀',
    '🫁','🦷','🦴','👀','👅','👄','👶','🧒','👦','👧','🧑','👱','👨','🧔','👨‍🦰','👨‍🦱',
    '🔥','🌈','☀️','⛈️','🌩️','❄️','🌵','🌷','🌲','🌳','🌴','🐲','🐉','🦕','🦖','🐍',
    '🐎','🦄','🦓','🐆','🐅','🐂','🐄','🐖','🐏','🐑','🐐','🐪','🐫','🦙','🦒','🐘',
    '🦏','🦛','🐁','🐀','🐹','🐰','🐇','🐿️','🦔','🦇','🐻','🐨','🐼','🦥','🦦','🦨',
    '🦘','🦡','🐾','🦃','🐔','🐓','🐣','🐤','🐥','🐦','🐧','🕊️','🦅','🦆','🦢','🦉',
    '🎈','🧨','🧧','🎀','🎁','🎗️','🎟️','🎫','🎖️','🏆','🏅','🥇','🥈','🥉','⚽','⚾',
    '🥎','🏀','🏐','🏈','🏉','🎾','🥏','🎳','🏏','🏑','🏒','🥍','🏓','🏸','🥊','🥋',
    '🥅','⛳','⛸️','🎣','🤿','🎽','🎿','🛷','🥌','🎯','🪀','🪁','🎱','🔮','🧿','🎮'
];

const C_KEYWORDS = [
    'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
    'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if',
    'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof', 'static',
    'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while',
    'include', 'define', 'main', 'printf', 'NULL'
];

const ASCII_CHARS = Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32))
    .concat(['\n', '\t', '\r']);

const TOTAL_TOKENS = C_KEYWORDS.length + ASCII_CHARS.length;

export class CipherEngine {
    constructor(password) {
        this.password = password;
        this.tokenMap = new Map();
        this.reverseMap = new Map();
        this.isReady = false;
        
        if (EMOJI_UNIVERSE.length < TOTAL_TOKENS) {
            throw new Error(`CRITICAL: Not enough emojis. Need ${TOTAL_TOKENS}, have ${EMOJI_UNIVERSE.length}`);
        }
    }

    async init(existingSaltHex = null) {
        this.salt = existingSaltHex 
            ? Buffer.from(existingSaltHex, 'hex') 
            : crypto.randomBytes(16);

        const derivedKey = await new Promise((resolve, reject) => {
            crypto.pbkdf2(this.password, this.salt, 100000, 36, 'sha256', (err, key) => {
                if (err) reject(err); else resolve(key);
            });
        });

        const seedBuffer = derivedKey.subarray(0, 4);
        this.authHash = derivedKey.subarray(4);
        const seedInt = seedBuffer.readUInt32BE(0);

        const shuffledEmojis = this._shuffleArray([...EMOJI_UNIVERSE], seedInt);

        let emojiIndex = 0;
        for (const keyword of C_KEYWORDS) {
            const emo = shuffledEmojis[emojiIndex++];
            this.tokenMap.set(keyword, emo);
            this.reverseMap.set(emo, keyword);
        }

        for (const char of ASCII_CHARS) {
            const emo = shuffledEmojis[emojiIndex++];
            this.tokenMap.set(char, emo);
            this.reverseMap.set(emo, char);
        }

        this.isReady = true;
    }

    _mulberry32(a) {
        return function() {
          var t = a += 0x6D2B79F5;
          t = Math.imul(t ^ t >>> 15, t | 1);
          t ^= t + Math.imul(t ^ t >>> 7, t | 61);
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }

    _shuffleArray(array, seed) {
        const rng = this._mulberry32(seed);
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    _encodeHeader() {
        const saltHex = this.salt.toString('hex');
        const authHex = this.authHash.toString('hex');
        const fullHexString = saltHex + authHex;

        let headerStr = '';
        for (const char of fullHexString) {
            const val = parseInt(char, 16);
            headerStr += HEADER_ALPHABET[val];
        }
        return headerStr + '\n';
    }

    static decodeHeader(headerStr) {
        let hexString = '';
        // Use segmenter here just in case moon emojis have variation selectors
        const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
        const segments = segmenter.segment(headerStr.trim());

        for (const { segment } of segments) {
            const index = HEADER_ALPHABET.indexOf(segment);
            if (index === -1) throw new Error("Invalid Header format.");
            hexString += index.toString(16);
        }
        const saltHex = hexString.substring(0, 32);
        const authHex = hexString.substring(32);
        return { saltHex, authHex };
    }

    getEncryptStream() {
        if (!this.isReady) throw new Error("Engine not initialized");
        const engine = this;
        const decoder = new StringDecoder('utf8');
        let buffer = '';

        return new Transform({
            transform(chunk, encoding, callback) {
                buffer += decoder.write(chunk);
                
                const sortedKeywords = [...C_KEYWORDS].sort((a, b) => b.length - a.length);
                const keywordPattern = sortedKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                const regex = new RegExp(`\\b(${keywordPattern})\\b|([\\s\\S])`, 'g');
                
                let match;
                let output = '';
                
                while ((match = regex.exec(buffer)) !== null) {
                    const token = match[0];
                    if (engine.tokenMap.has(token)) {
                        output += engine.tokenMap.get(token);
                    } else {
                        output += token; 
                    }
                }
                
                buffer = ''; 
                this.push(output);
                callback();
            },
            flush(callback) {
                buffer += decoder.end();
                // Simple flush for MVP; in prod, we'd regex one last time.
                callback();
            }
        });
    }

    getDecryptStream() {
        if (!this.isReady) throw new Error("Engine not initialized");
        const engine = this;
        const decoder = new StringDecoder('utf8');
        const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
        
        let buffer = '';

        return new Transform({
            transform(chunk, encoding, callback) {
                // 1. Decode bytes to string (handles partial UTF8 bytes)
                buffer += decoder.write(chunk);
                
                // 2. Segment into Graphemes (Emojis)
                const segments = [...segmenter.segment(buffer)];
                
                // 3. Process all BUT the last segment
                // We keep the last segment in the buffer because it might be 
                // the start of a multi-codepoint emoji that was split by the chunk boundary.
                // (e.g. Base char is here, Variation Selector is in next chunk)
                
                const processUntilIndex = segments.length > 1 ? segments.length - 1 : 0;
                let output = '';
                let processedString = '';

                // If we only have 1 segment, we can't be sure it's complete, wait for next chunk
                // UNLESS the buffer is getting huge, then force it.
                if (segments.length === 1 && buffer.length < 100) {
                     // Wait for more data
                     callback();
                     return;
                }

                // Process safe segments
                for (let i = 0; i < processUntilIndex; i++) {
                    const char = segments[i].segment;
                    processedString += char;
                    
                    if (engine.reverseMap.has(char)) {
                        output += engine.reverseMap.get(char);
                    } else {
                        output += char;
                    }
                }

                // Update buffer to only contain the remaining tail
                // Note: buffer might contain bytes not yet in segments if StringDecoder held them? 
                // No, decoder.write returns what is available.
                // We just need to remove the processed part from the buffer string.
                if (processUntilIndex > 0) {
                    buffer = buffer.slice(processedString.length);
                    this.push(output);
                }
                
                callback();
            },
            flush(callback) {
                // Process any remaining tail (buffer + decoder leftovers)
                buffer += decoder.end();
                if (buffer) {
                    const segments = segmenter.segment(buffer);
                    let output = '';
                    for (const { segment } of segments) {
                        if (engine.reverseMap.has(segment)) output += engine.reverseMap.get(segment);
                        else output += segment;
                    }
                    this.push(output);
                }
                callback();
            }
        });
    }
}