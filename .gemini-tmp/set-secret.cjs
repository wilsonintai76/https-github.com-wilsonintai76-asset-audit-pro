const { execFileSync } = require('child_process');
const secret = 'Vk77lKqIvYWeKrOfHKtzxR1Ey9FsdoPjDc1BYoV1X1sR1FbH6y4kIkoo2bNSSpBJLsS+vjgpf0bMSmLmyojICQ==';
try {
    execFileSync('npx.cmd', ['wrangler', 'secret', 'put', 'SUPABASE_JWT_SECRET'], { input: secret, stdio: ['pipe', 'inherit', 'inherit'] });
    console.log('Secret successfully uploaded.');
} catch (e) {
    console.log('Upload failed:', e.message);
}
