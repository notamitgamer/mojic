#!/usr/bin/env node

import { program } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { Transform } from 'stream';
import { StringDecoder } from 'string_decoder';
import { CipherEngine } from '../lib/CipherEngine.js';

program
    .name('mojic')
    .description('Obfuscate C source code into emojis')
    .version('1.2.2')
    .addHelpCommand('help [command]', 'Display help for command')
    .showHelpAfterError();

// --- Helpers ---

const promptPassword = async (msg) => {
    const { password } = await inquirer.prompt([{
        type: 'password', name: 'password', message: msg, mask: '*',
        validate: (input) => input.length > 5 || 'Password must be > 5 chars.'
    }]);
    return password;
};

const getStreamHeader = async (filePath) => {
    const fileStream = fs.createReadStream(filePath, { highWaterMark: 1024 });
    const decoder = new StringDecoder('utf8');
    
    return new Promise((resolve, reject) => {
        let buffer = '';
        let found = false;
        
        fileStream.on('data', (chunk) => {
            if (found) return;
            buffer += decoder.write(chunk);
            const newlineIndex = buffer.indexOf('\n');
            if (newlineIndex !== -1) {
                found = true;
                fileStream.destroy();
                resolve(buffer.substring(0, newlineIndex));
            }
        });
        
        fileStream.on('end', () => {
            if (!found) resolve(buffer + decoder.end());
        });
        fileStream.on('error', reject);
    });
};

const createHeaderSkipper = () => {
    const decoder = new StringDecoder('utf8');
    let isHeaderSkipped = false;
    let buffer = '';

    return new Transform({
        transform(chunk, encoding, cb) {
            if (isHeaderSkipped) {
                this.push(chunk);
                return cb();
            }
            
            buffer += decoder.write(chunk);
            const nlIndex = buffer.indexOf('\n');
            
            if (nlIndex !== -1) {
                const remainder = buffer.substring(nlIndex + 1);
                this.push(remainder);
                isHeaderSkipped = true;
                buffer = '';
            }
            cb();
        }
    });
};

// --- FLATTENING (Minifier) ---
const createMinifier = () => {
    return new Transform({
        transform(chunk, encoding, cb) {
            let str = chunk.toString();
            str = str.replace(/\r?\n|\r/g, ' '); 
            str = str.replace(/\s+/g, ' ');      
            this.push(str);
            cb();
        }
    });
};

// --- Recursive Logic ---

async function traverseDirectory(currentPath, extension, callback) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
            await traverseDirectory(fullPath, extension, callback);
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
            await callback(fullPath);
        }
    }
}

// --- Main Commands ---

program
    .command('encode')
    .argument('<path>', 'File or Directory to encode')
    .option('-r, --recursive', 'Recursively encrypt all .c files in directory')
    .option('-f, --flat', 'Flatten structure (strip whitespace/newlines) before encrypting')
    .description('Encrypt a file or directory into emojis')
    .action(async (targetPath, options) => {
        try {
            if (!fs.existsSync(targetPath)) throw new Error('Path not found');
            const stats = fs.statSync(targetPath);

            if (stats.isDirectory() && !options.recursive) {
                throw new Error(`'${targetPath}' is a directory. Use -r to process recursively.`);
            }

            console.log(chalk.blue('Initiating Mojic Encryption v1.1...'));
            if (options.flat) console.log(chalk.yellow('   -> Structural Flattening Enabled'));

            const password = await promptPassword('Create password for file(s):');

            const processFile = async (filePath) => {
                const outputName = filePath.replace(/\.c$/, '') + '.mojic';
                console.log(chalk.dim(`   Processing: ${path.basename(filePath)} -> ${path.basename(outputName)}`));

                const engine = new CipherEngine(password);
                await engine.init(); 
                
                const readStream = fs.createReadStream(filePath);
                const writeStream = fs.createWriteStream(outputName);
                
                writeStream.write(engine._encodeHeader());
                
                await new Promise((resolve, reject) => {
                    let pipeline = readStream;
                    
                    if (options.flat) {
                        pipeline = pipeline.pipe(createMinifier());
                    }

                    pipeline
                        .pipe(engine.getEncryptStream())
                        .pipe(writeStream)
                        .on('finish', resolve)
                        .on('error', reject);
                });
            };

            if (stats.isDirectory()) {
                console.log(chalk.blue(`Scanning directory: ${targetPath}`));
                await traverseDirectory(targetPath, '.c', processFile);
                console.log(chalk.green('Batch encryption complete.'));
            } else {
                await processFile(targetPath);
                console.log(chalk.green(`Encrypted.`));
            }

        } catch (err) {
            console.error(chalk.red('Error:'), err.message);
        }
    });

program
    .command('decode')
    .argument('<path>', 'File or Directory to decode')
    .option('-r, --recursive', 'Recursively decode all .mojic files')
    .description('Restore mojic files to C source code')
    .action(async (targetPath, options) => {
        try {
            if (!fs.existsSync(targetPath)) throw new Error('Path not found');
            const stats = fs.statSync(targetPath);

            if (stats.isDirectory() && !options.recursive) {
                throw new Error(`'${targetPath}' is a directory. Use -r to process recursively.`);
            }

            console.log(chalk.blue('Initiating Decryption...'));
            const password = await promptPassword('Enter password:');

            const processFile = async (filePath) => {
                try {
                    const outputName = filePath.replace(/\.mojic$/, '') + '.restored.c';
                    console.log(chalk.dim(`   Restoring: ${path.basename(filePath)}`));

                    const headerStr = await getStreamHeader(filePath);
                    const metadata = CipherEngine.decodeHeader(headerStr);
                    
                    const engine = new CipherEngine(password);
                    
                    // Pass the Auth Check Hex (if available in new format)
                    await engine.init(metadata.saltHex, metadata.authCheckHex);

                    const readStream = fs.createReadStream(filePath);
                    const writeStream = fs.createWriteStream(outputName);
                    
                    await new Promise((resolve, reject) => {
                        const decryptStream = engine.getDecryptStream();
                        
                        decryptStream.on('error', (err) => {
                            reject(err);
                        });

                        readStream
                            .pipe(createHeaderSkipper())
                            .pipe(decryptStream)
                            .pipe(writeStream)
                            .on('finish', resolve)
                            .on('error', reject);
                    });

                    return true; // Success
                } catch (e) {
                    const outputName = filePath.replace(/\.mojic$/, '') + '.restored.c';
                    
                    // Cleanup output file on error
                    setTimeout(() => {
                         if (fs.existsSync(outputName)) {
                             try { fs.unlinkSync(outputName); } catch(ign){}
                         }
                    }, 100);
                    
                    // Specific Error Messaging (No Emojis)
                    if (e.message === "WRONG_PASSWORD") {
                        console.log(chalk.red(`   Error: Incorrect Password`));
                    } else if (e.message === "FILE_TAMPERED") {
                        console.log(chalk.red(`   Error: File Tampered! Integrity check failed.`));
                    } else {
                        console.log(chalk.red(`   Error: ${e.message}`));
                    }

                    return false; // Failure
                }
            };

            if (stats.isDirectory()) {
                console.log(chalk.blue(`Scanning directory: ${targetPath}`));
                await traverseDirectory(targetPath, '.mojic', processFile);
                console.log(chalk.green('Batch decryption complete.'));
            } else {
                const success = await processFile(targetPath);
                if (success) {
                    console.log(chalk.green(`Restored.`));
                }
            }

        } catch (err) {
            console.error(chalk.red('Error:'), err.message);
        }
    });

// --- SRT ---

const rotatePassword = async (file) => {
    try {
        if (!fs.existsSync(file)) throw new Error('File not found');
        console.log(chalk.yellow(`Rotating Password for ${path.basename(file)}...`));

        const headerStr = await getStreamHeader(file);
        const metadata = CipherEngine.decodeHeader(headerStr);
        const oldPass = await promptPassword('Enter CURRENT password:');
        
        const oldEngine = new CipherEngine(oldPass);
        await oldEngine.init(metadata.saltHex, metadata.authCheckHex);

        const newPass = await promptPassword('Enter NEW password:');
        const newEngine = new CipherEngine(newPass);
        await newEngine.init(); 

        const tempFile = file + '.tmp';
        const readStream = fs.createReadStream(file);
        const writeStream = fs.createWriteStream(tempFile);

        writeStream.write(newEngine._encodeHeader());

        await new Promise((resolve, reject) => {
            const decryptStream = oldEngine.getDecryptStream();
            
            decryptStream.on('error', (err) => reject(err));

            readStream
                .pipe(createHeaderSkipper())
                .pipe(decryptStream)
                .pipe(newEngine.getEncryptStream())
                .pipe(writeStream)
                .on('finish', resolve)
                .on('error', reject);
        });

        fs.renameSync(tempFile, file);
        console.log(chalk.green(`Password updated.`));
        
    } catch (err) {
        if (fs.existsSync(file + '.tmp')) fs.unlinkSync(file + '.tmp');
        if (err.message === "WRONG_PASSWORD") {
            console.error(chalk.red('Error: Incorrect Current Password'));
        } else {
            console.error(chalk.red('Error:'), err.message);
        }
    }
};

const reEncrypt = async (file) => {
    try {
        if (!fs.existsSync(file)) throw new Error('File not found');
        console.log(chalk.yellow(`Re-shuffling Entropy for ${path.basename(file)}...`));

        const headerStr = await getStreamHeader(file);
        const metadata = CipherEngine.decodeHeader(headerStr);
        const password = await promptPassword('Enter password:');
        
        const oldEngine = new CipherEngine(password);
        await oldEngine.init(metadata.saltHex, metadata.authCheckHex);

        const newEngine = new CipherEngine(password);
        await newEngine.init(); 

        const tempFile = file + '.tmp';
        const readStream = fs.createReadStream(file);
        const writeStream = fs.createWriteStream(tempFile);

        writeStream.write(newEngine._encodeHeader());

        await new Promise((resolve, reject) => {
            const decryptStream = oldEngine.getDecryptStream();
            decryptStream.on('error', (err) => reject(err));

            readStream
                .pipe(createHeaderSkipper())
                .pipe(decryptStream)
                .pipe(newEngine.getEncryptStream())
                .pipe(writeStream)
                .on('finish', resolve)
                .on('error', reject);
        });

        fs.renameSync(tempFile, file);
        console.log(chalk.green(`File re-encrypted.`));

    } catch (err) {
        if (fs.existsSync(file + '.tmp')) fs.unlinkSync(file + '.tmp');
        if (err.message === "WRONG_PASSWORD") {
            console.error(chalk.red('Error: Incorrect Password'));
        } else {
            console.error(chalk.red('Error:'), err.message);
        }
    }
};

program
    .command('srt')
    .description('Security and Rotation Tools')
    .option('--pass <file>', 'Update the password for an existing file')
    .option('--re <file>', 'Re-encrypt with new random seed (Same password)')
    .action(async (options) => {
        if (options.pass) {
            await rotatePassword(options.pass);
        } else if (options.re) {
            await reEncrypt(options.re);
        } else {
            console.log(chalk.yellow('Please specify an option: --pass <file> or --re <file>'));
            program.commands.find(c => c.name() === 'srt').help();
        }
    });

program.parse(process.argv);