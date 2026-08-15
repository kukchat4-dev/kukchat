import forge from 'node-forge';

// 1. Generates a fresh set of Public (Lock) and Private (Key) keys
export const generateRSAKeys = () => {
  return new Promise<{ publicKey: string, privateKey: string }>((resolve, reject) => {
    // 2048-bit encryption is the industry standard for secure messaging
    forge.pki.rsa.generateKeyPair({ bits: 2048, workers: 2 }, (err, keypair) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Convert the raw math into savable text strings
      const publicKey = forge.pki.publicKeyToPem(keypair.publicKey);
      const privateKey = forge.pki.privateKeyToPem(keypair.privateKey);
      
      resolve({ publicKey, privateKey });
    });
  });
};

// 2. Locks a message using your FRIEND'S Public Key
export const encryptMessage = (text: string, friendPublicKeyPem: string) => {
  try {
    const publicKey = forge.pki.publicKeyFromPem(friendPublicKeyPem);
    // RSA-OAEP is a highly secure padding scheme
    const encrypted = publicKey.encrypt(text, 'RSA-OAEP'); 
    return forge.util.encode64(encrypted);
  } catch (error) {
    console.error("Encryption failed:", error);
    return null;
  }
};

// 3. Unlocks a message using YOUR Private Key
export const decryptMessage = (encryptedBase64: string, myPrivateKeyPem: string) => {
  try {
    const privateKey = forge.pki.privateKeyFromPem(myPrivateKeyPem);
    const encrypted = forge.util.decode64(encryptedBase64);
    const decrypted = privateKey.decrypt(encrypted, 'RSA-OAEP');
    return decrypted;
  } catch (error) {
    console.log("Decryption failed. This message was likely encrypted with a different key.");
    return null;
  }
};