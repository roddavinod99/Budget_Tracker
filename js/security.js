const security = {
  // Use a fixed salt. In a real-world multi-user system, this would be unique per user.
  // For a personal tool, a fixed salt stored in the code is a reasonable simplification,
  // though storing it in localStorage is also an option.
  getSalt: () => {
    let salt = localStorage.getItem('salt');
    if (!salt) {
      salt = CryptoJS.lib.WordArray.random(128 / 8).toString();
      localStorage.setItem('salt', salt);
    }
    return salt;
  },

  // Derive a key from the user's password
  deriveKey: (password, salt) => {
    return CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 1000
    });
  },

  // Encrypt data
  encrypt: (data, key) => {
    const dataString = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(dataString, key.toString());
    return encrypted.toString();
  },

  // Decrypt data
  decrypt: (encryptedData, key) => {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedData, key.toString());
      const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decryptedString);
    } catch (e) {
      console.error("Decryption failed: ", e);
      return null;
    }
  }
};
