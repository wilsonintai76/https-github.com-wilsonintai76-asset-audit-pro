import { hc } from 'hono/client';
const client = hc('http://localhost');
// Usually $get returns a Promise<Response>. We can't easily see the Request object because it's executed immediately using fetch().
// But we can monkey-patch global fetch to see what URL and options are passed!
global.fetch = async (url, options) => {
    console.log("Fetch called with:", url);
    console.log("Options:", options);
    return new Response("{}");
};

async function test() {
    await (client.db['system-settings'].$get)({}, { headers: { Authorization: 'Bearer test' } });
    await (client.db['system-settings'].$get)({ header: { Authorization: 'Bearer test2' } });
}
test();
