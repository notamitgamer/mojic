# Mojic v1.2.5

> **Operation Polymorphic Chaos: Obfuscate C source code into a randomized, password-seeded stream of emojis.**

**Mojic** (Magic + Emoji + Logic) is a sophisticated CLI tool designed to transform readable C code into an unrecognizable chaotic stream of emojis. Unlike simple substitution ciphers, Mojic uses your password to seed a cryptographically strong Pseudo-Random Number Generator (PRNG), creating a unique "Emoji Universe" and rolling cipher for every single session.

## Key Features

* ** Xoshiro256** PRNG:** Uses a high-quality 256-bit state PRNG (seeded via PBKDF2-SHA512) to handle shuffling and polymorphism.
* ** Polymorphic Keywords:** Common C keywords (`int`, `void`, `return`) are mapped to emojis that *change* every time they appear based on the PRNG state. Frequency analysis is impossible.
* ** Base-1024 Compression:** Non-keyword code is compressed using a custom Base-1024 scheme (5 bytes → 4 emojis), keeping file size manageable.
* ** Integrity Sealed:** Every file ends with an HMAC-SHA256 signature. Any tampering with the emoji stream results in an immediate `FILE_TAMPERED` error.
* ** Moon Header Protocol:** Metadata (Salt + Auth Check) is encoded using a specific alphabet of Moon and Clock phases (`🌑🌒🕐`), allowing instant password verification before decryption starts.
* ** Stream Architecture:** Built on Node.js `Transform` streams to handle large files efficiently with minimal memory footprint.

## Installation

Since Mojic is available on npm, you can install it globally with a single command:

```bash
npm install -g mojic
```

Or run it directly using `npx` without installing:

```bash
npx mojic encode main.c
```

## Usage

### 1. Encrypting Code (`encode`)
Transforms a `.c` file into a `.mojic` file.

```bash
# Encrypt a single file
mojic encode main.c

# Encrypt an entire directory recursively
mojic encode ./src -r

# Flatten/Minify code structure before encryption (Removes newlines/indentation)
mojic encode main.c --flat
```
*You will be prompted to create a password. This password is required to decrypt.*

### 2. Decrypting Code (`decode`)
Restores the original C code from a `.mojic` file.

```bash
# Decrypt a single file
mojic decode main.mojic

# Decrypt an entire directory recursively
mojic decode ./src -r
```

### 3. Security & Rotation Tools (`srt`)
Manage encrypted files without ever revealing their plaintext contents.

```bash
# Rotate Password: Changes the password of an encrypted file
mojic srt --pass secret.mojic

# Re-Encrypt: Re-shuffles the entropy (New Salt) with the SAME password
# (Useful to change the visual emoji pattern without changing the password)
mojic srt --re secret.mojic
```

## Under the Hood (Algorithm)

Mojic v1.1.0 implements a custom crypto-system dubbed **"Operation Polymorphic Chaos"**.

1.  **Derivation Phase:**
    * **Input:** User Password + 16-byte Random Salt.
    * **KDF:** `PBKDF2-SHA512` (100,000 iterations).
    * **Output:** 64 bytes (32 bytes for PRNG Seed, 32 bytes for HMAC Auth Key).

2.  **The Emoji Universe:**
    * The engine generates a universe of ~1,100 valid emojis (Emoticons, Transport, Symbols).
    * This universe is **shuffled** using the `Xoshiro256**` PRNG initialized with the derived seed.

3.  **Polymorphic Encryption:**
    * **C Keywords:** The engine detects C keywords (e.g., `while`). It assigns them a "Base Emoji" from the shuffled universe.
    * **The Twist:** It doesn't just print the Base Emoji. It calculates a random offset using the PRNG to pick a *different* emoji that maps back to the keyword. This means `int` might look like `🚀` on line 1 and `🌮` on line 5.

4.  **Base-1024 Encoding:**
    * Non-keyword data is buffered into 5-byte chunks.
    * These chunks are treated as a single large integer and converted into 4 base-1024 digits (mapped to emojis), effectively compressing the stream density.

5.  **The Header:**
    * The Salt and a 4-byte Auth Check are written to the file header using the **Moon/Clock Alphabet** (`🌑🌒🌓🌔...`).
    * **Benefit:** This allows `mojic` to tell you "Incorrect Password" instantly, rather than churning out garbage data first.

## License

This project is licensed under the Apache License 2.0.
