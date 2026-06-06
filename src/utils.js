export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatNumber(n) {
    return new Intl.NumberFormat().format(n);
}

// Compact number formatting for tight UI (e.g. stat cells): 1234 -> "1.2k", 1_200_000 -> "1.2m".
export function formatCompact(n) {
    return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
        .format(n).toLowerCase();
}

// Format a completion ratio as a one-decimal percentage string.
// Never reports 100% unless every pixel is correct (avoids 99.96 → "100.0").
export function formatPct(correct, total) {
    if (total <= 0) return '0.0';
    if (correct >= total) return '100';
    const pct = correct / total * 100;
    return Math.min(pct, 99.9).toFixed(1);
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
