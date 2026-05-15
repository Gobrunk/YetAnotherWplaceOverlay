export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatNumber(n) {
    return new Intl.NumberFormat().format(n);
}

export function formatPercent(ratio) {
    return new Intl.NumberFormat(undefined, {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(ratio);
}

export function formatDate(date) {
    return date.toLocaleString(undefined, {
        weekday: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

export function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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

export function decodeBase(str, alphabet) {
    let result = 0;
    const base = alphabet.length;
    for (const char of str) {
        const idx = alphabet.indexOf(char);
        if (idx === -1) consoleError(`Invalid character '${char}' encountered whilst decoding! Is the decode alphabet/base incorrect?`);
        result = result * base + idx;
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

export function calculateLuminance(rgb) {
    const channels = rgb.map(c => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function rgbToHex(r, g, b) {
    if (Array.isArray(r)) ([r, g, b] = r);
    return (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
}
