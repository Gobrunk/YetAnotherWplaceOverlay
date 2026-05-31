export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatNumber(n) {
    return new Intl.NumberFormat().format(n);
}

export function consoleLog(...args) {
    (0, console.log)(...args);
}

export function consoleError(...args) {
    (0, console.error)(...args);
}

export function consoleWarn(...args) {
    (0, console.warn)(...args);
}

export function encodeBase(n, alphabet) {
    if (n === 0) return alphabet[0];
    let result = '';
    const base = alphabet.length;
    while (n > 0) {
        result = alphabet[n % base] + result;
        n = Math.floor(n / base);
    }
    return result;
}

export function uint8ToBase64(arr) {
    let str = '';
    for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]);
    return btoa(str);
}

export function base64ToUint8(str) {
    const binary = atob(str);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return arr;
}
