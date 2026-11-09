// Messaging, login and roles (recruit, recruiter, hiring manager). Needs a fresh database; run with `npm test`.
import { ok, login, req, json, post, next, connect } from './lib.mjs';

ok((await login('sam.reid@example.com', 'wrong')).status === 401, 'wrong password rejected');
ok((await req('/api/conversations')).status === 401, 'API needs login');
ok((await req('/staff/')).headers.get('location') === '/login.html', 'staff page redirects to login when logged out');

const U = {};
for (const n of ['alex.kim', 'priya.shah', 'owen.davies', 'sam.reid', 'jordan.ellis', 'hannah.price', 'leah.thompson']) U[n.split('.')[0]] = await login(`${n}@example.com`);
ok(Object.values(U).every((u) => u.status === 200), 'all 7 demo accounts log in');
ok((await login('maya.okafor@example.com')).status === 401, 'buddy accounts no longer exist');
ok(U.alex.body.home === '/joiner/' && U.sam.body.home === '/staff/' && U.jordan.body.home === '/staff/', 'recruits go to /joiner/, staff to /staff/');
ok((await req('/staff/', U.alex.cookie)).headers.get('location') === '/', 'recruit cannot open the staff hub');
ok((await req('/joiner/', U.sam.cookie)).headers.get('location') === '/', 'manager cannot open the recruit screen');

const alexConvs = (await json('/api/conversations', U.alex.cookie)).conversations;
const kinds = Object.fromEntries(alexConvs.map((c) => [c.kind, c]));
ok(alexConvs.length === 2 && kinds.manager.other.name === 'Sam Reid' && kinds.recruiter.other.name === 'Jordan Ellis', 'Alex (offer accepted) has recruiter Jordan and manager Sam');
ok(kinds.recruiter.unread === 1 && kinds.manager.unread === 0, 'Alex unread counts are right');
const priyaMe = await json('/api/me', U.priya.cookie);
ok(priyaMe.circle.manager === null && priyaMe.circle.recruiter.name === 'Jordan Ellis', 'Priya (mid-screening) is not connected to her manager yet');
ok(!('buddy' in priyaMe.circle), 'no buddy role in the circle');

const jordanConvs = (await json('/api/conversations', U.jordan.cookie)).conversations;
ok(jordanConvs.map((c) => c.joiner.name).sort().join() === 'Alex Kim,Owen Davies,Priya Shah', 'recruiter chats with all three recruits');
const samConvs = (await json('/api/conversations', U.sam.cookie)).conversations;
ok(samConvs.map((c) => c.joiner.name).join() === 'Alex Kim', 'Sam only sees Alex (Priya has not accepted yet)');
ok(samConvs[0].unread === 1, "Alex's question is unread for Sam");
ok(samConvs[0].circle.recruiter.name === 'Jordan Ellis', "staff see the recruit's circle");

const mgrId = kinds.manager.id, recId = kinds.recruiter.id;
for (const who of ['jordan', 'priya', 'hannah', 'leah']) ok((await req(`/api/conversations/${mgrId}/messages`, U[who].cookie)).status === 404, `${who} can't read the Alex–Sam chat`);
ok((await req(`/api/conversations/${recId}/messages`, U.sam.cookie)).status === 404, "manager can't read the Alex–Jordan recruiter chat");
ok((await post(`/api/conversations/${recId}/read`, U.sam.cookie)).status === 404, "manager can't mark the recruiter chat read");

const S = { alex: await connect(U.alex.cookie), sam: await connect(U.sam.cookie), jordan: await connect(U.jordan.cookie), hannah: await connect(U.hannah.cookie) };
ok(true, 'sockets connected');
const seen = { sam: [], jordan: [], hannah: [] };
for (const k of Object.keys(seen)) S[k].on('message:new', (m) => seen[k].push(m.conversationId));
for (const [who, convId] of [['sam', mgrId], ['jordan', recId]]) {
  const p = next(S[who], 'message:new');
  const ack = await S.alex.emitWithAck('message:send', { conversationId: convId, body: `  Hi ${who}  ` });
  const m = await p;
  ok(ack.ok && m.body === `Hi ${who}` && m.senderName === 'Alex Kim', `Alex → ${who} delivered live (trimmed)`);
  const p2 = next(S.alex, 'message:new');
  await S[who].emitWithAck('message:send', { conversationId: convId, body: `Reply from ${who}` });
  ok((await p2).body === `Reply from ${who}`, `${who} → Alex delivered live`);
}
await new Promise((r) => setTimeout(r, 200));
ok(seen.sam.every((id) => id === mgrId), 'manager only received manager-chat messages');
ok(seen.jordan.every((id) => id === recId), 'recruiter only received recruiter-chat messages');
ok(seen.hannah.length === 0, 'unrelated manager received nothing');
const tp = next(S.sam, 'typing');
S.alex.emit('typing', { conversationId: mgrId });
ok((await tp).conversationId === mgrId, 'typing indicator reaches the manager');
const rp = next(S.alex, 'conversation:read');
await post(`/api/conversations/${mgrId}/read`, U.sam.cookie);
ok((await rp).readerId === U.sam.body.user.id, 'read receipt reaches Alex');
ok((await S.sam.emitWithAck('message:send', { conversationId: recId, body: 'snoop' })).error, "manager can't post into the recruiter chat");
ok((await S.hannah.emitWithAck('message:send', { conversationId: mgrId, body: 'snoop' })).error, "other manager can't post to Alex");
ok((await S.alex.emitWithAck('message:send', { conversationId: mgrId, body: '   ' })).error, 'empty message rejected');
ok((await S.alex.emitWithAck('message:send', { conversationId: mgrId, body: 'x'.repeat(2001) })).error, 'over-long message rejected');
await post('/api/logout', U.alex.cookie);
ok((await req('/api/me', U.alex.cookie)).status === 401, 'logout ends the session');
Object.values(S).forEach((s) => s.close());
