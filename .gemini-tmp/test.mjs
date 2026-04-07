import crypto from 'node:crypto';

async function testWebCrypto() {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3aGtyYmN2YnFxY2xxZHBpZ3p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNjYwNTUsImV4cCI6MjA4NzY0MjA1NX0.lNbwNMvO3lrKCbE3DZ1bxiO-iUzTM7u0LY2dzTK91D4';
    const secret = 'Vk77lKqIvYWeKrOfHKtzxR1Ey9FsdoPjDc1BYoV1X1sR1FbH6y4kIkoo2bNSSpBJLsS+vjgpf0bMSmLmyojICQ==';

    const parts = token.split('.');
    
    function b64urlToBytes(b64url) {
        let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
        // Pad with =
        while (b64.length % 4 !== 0) {
            b64 += '=';
        }
        return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    }

    const sigInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const sig = b64urlToBytes(parts[2]);
    const keyBytes = new TextEncoder().encode(secret);
    
    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['verify']
    );

    const valid = await crypto.subtle.verify(
        'HMAC', cryptoKey, sig, sigInput
    );
    
    console.log("Web Crypto Valid:", valid);
}

testWebCrypto();
