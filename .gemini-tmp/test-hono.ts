import { verify } from 'hono/jwt';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3aGtyYmN2YnFxY2xxZHBpZ3p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNjYwNTUsImV4cCI6MjA4NzY0MjA1NX0.lNbwNMvO3lrKCbE3DZ1bxiO-iUzTM7u0LY2dzTK91D4';
const secret = 'Vk77lKqIvYWeKrOfHKtzxR1Ey9FsdoPjDc1BYoV1X1sR1FbH6y4kIkoo2bNSSpBJLsS+vjgpf0bMSmLmyojICQ==';

async function run() {
    try {
        console.log("Verifying with plain secret...");
        const res = await verify(token, secret, 'HS256');
        console.log('SUCCESS: Plain secret');
    } catch(e) {
        console.log('FAIL Plain secret:', e.message);
    }
}
run();
