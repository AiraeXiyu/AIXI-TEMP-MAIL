const BASE_URL = 'https://akunlama.com/api';
const DOMAIN = 'akunlama.com';
const CREATOR = 'AIXI CODEX';

const ADJECTIVES = [
  'happy', 'sleepy', 'clever', 'swift', 'brave', 'calm',
  'wild', 'gentle', 'lucky', 'proud', 'cozy', 'fuzzy'
];

const ANIMALS = [
  'kitten', 'cat', 'tiger', 'lion', 'panther',
  'cheetah', 'lynx', 'puma', 'jaguar', 'leopard'
];

function cleanRecipient(value) {
  return String(value || '')
    .replace(new RegExp(`@${DOMAIN.replace('.', '\\.')}$`, 'i'), '')
    .trim();
}

function generateRandomName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}-${animal}-${num}`;
}

function stripHtml(html) {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractOtp(text) {
  if (!text) return null;

  const labeled = text.match(
    /(?:otp|code|verification|kode|verifikasi)[\s:=#-]+([0-9]{4,8})/i
  );
  if (labeled) return labeled[1];

  const standalone = text.match(
    /\b(?!(?:19\d\d|20\d\d)\b)([0-9]{4,8})\b/
  );
  return standalone ? standalone[1] : null;
}

function extractLinks(html) {
  if (typeof html !== 'string') return [];

  const links = [];
  const regex = /href=["'](https?:\/\/[^"']+)["']/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const link = match[1].replace(/&amp;/g, '&');
    if (!links.includes(link)) links.push(link);
  }

  return links;
}

function parseTimestamp(ts) {
  if (!ts) return null;
  const millis = Number(ts) > 1e11 ? Number(ts) : Number(ts) * 1000;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function requestJson(targetUrl) {
  const response = await fetch(targetUrl);

  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function listInbox(username) {
  const recipient = cleanRecipient(username);
  const targetUrl =
    `${BASE_URL}/list?recipient=${encodeURIComponent(recipient)}`;

  const result = await requestJson(targetUrl);
  return Array.isArray(result) ? result : [];
}

async function getEmailDetail(region, key) {
  const metaUrl =
    `${BASE_URL}/getKey?region=${encodeURIComponent(region)}&key=${encodeURIComponent(key)}`;

  const htmlUrl =
    `${BASE_URL}/getHtml?region=${encodeURIComponent(region)}&key=${encodeURIComponent(key)}`;

  const [meta, html] = await Promise.all([
    requestJson(metaUrl),
    requestJson(htmlUrl)
  ]);

  const rawHtml =
    typeof html === 'string' ? html : JSON.stringify(html);

  const text = stripHtml(rawHtml);
  const links = extractLinks(rawHtml);
  const otp = extractOtp(text);

  return {
    meta,
    html: rawHtml,
    text,
    links,
    possibleOtp: otp
  };
}

function success(data = {}) {
  return {
    creator: CREATOR,
    status: 'success',
    ...data
  };
}

function error(message) {
  return {
    creator: CREATOR,
    status: 'error',
    message
  };
}

function opGenerate() {
  const username = generateRandomName();

  return success({
    data: {
      email: `${username}@${DOMAIN}`,
      username,
      domain: DOMAIN
    }
  });
}

function opUse(target) {
  if (!target) {
    return error(
      'Username or email required. Usage: /api/use?user=<name>'
    );
  }

  const username = cleanRecipient(target);

  return success({
    message: `Active mailbox set to ${username}@${DOMAIN}`,
    data: {
      email: `${username}@${DOMAIN}`,
      username,
      domain: DOMAIN
    }
  });
}

async function opInbox(username) {
  const clean = cleanRecipient(username);

  if (!clean) {
    return error(
      'Username or email required: /api/inbox?user=<name>'
    );
  }

  const messages = await listInbox(clean);

  const formatted = messages.map((message, index) => {
    const headers = message.message?.headers || {};

    return {
      index: index + 1,
      id: message.storage?.key || null,
      region: message.storage?.region || 'us',
      from: headers.from || message.sender || null,
      subject: headers.subject || message.preview || '(No Subject)',
      date: parseTimestamp(message.timestamp)
    };
  });

  return success({
    email: `${clean}@${DOMAIN}`,
    total: formatted.length,
    messages: formatted
  });
}

async function opRead(username, indexOrKey) {
  const clean = cleanRecipient(username);

  if (!clean) {
    return error('Username or email required');
  }

  const messages = await listInbox(clean);

  if (!messages.length) {
    return error(`Mailbox ${clean}@${DOMAIN} is empty`);
  }

  const requested = String(indexOrKey || '1');
  let selected = null;
  let targetIndex = null;

  const parsedIndex = Number.parseInt(requested, 10);

  if (
    Number.isInteger(parsedIndex) &&
    parsedIndex > 0 &&
    parsedIndex <= messages.length
  ) {
    targetIndex = parsedIndex;
    selected = messages[parsedIndex - 1];
  } else {
    const foundIndex = messages.findIndex(
      message => message.storage?.key === requested
    );

    if (foundIndex !== -1) {
      targetIndex = foundIndex + 1;
      selected = messages[foundIndex];
    }
  }

  if (!selected) {
    return error(
      `Message '${requested}' not found. Available index: 1..${messages.length}`
    );
  }

  const region = selected.storage?.region || 'us';
  const key = selected.storage?.key;

  if (!key) {
    return error('Selected message has no storage key');
  }

  const detail = await getEmailDetail(region, key);

  return success({
    data: {
      index: targetIndex,
      id: key,
      region,
      from: detail.meta?.name
        ? `${detail.meta.name} <${detail.meta.emailAddress}>`
        : (detail.meta?.emailAddress || null),
      to: detail.meta?.recipients || `${clean}@${DOMAIN}`,
      subject: detail.meta?.subject || '(No Subject)',
      date: detail.meta?.Date || parseTimestamp(selected.timestamp),
      otp: detail.possibleOtp || null,
      links: detail.links || [],
      text: detail.text,
      html: detail.html
    }
  });
}

async function opDump(username) {
  const clean = cleanRecipient(username);

  if (!clean) {
    return error('Username or email required for dump');
  }

  const list = await listInbox(clean);
  const messages = [];

  for (let index = 0; index < list.length; index++) {
    const item = list[index];
    const region = item.storage?.region || 'us';
    const key = item.storage?.key;

    if (!key) continue;

    const detail = await getEmailDetail(region, key);

    messages.push({
      index: index + 1,
      id: key,
      region,
      from: detail.meta?.name
        ? `${detail.meta.name} <${detail.meta.emailAddress}>`
        : (
            detail.meta?.emailAddress ||
            item.message?.headers?.from ||
            null
          ),
      to: detail.meta?.recipients || `${clean}@${DOMAIN}`,
      subject:
        detail.meta?.subject ||
        item.message?.headers?.subject ||
        item.preview ||
        '(No Subject)',
      date:
        detail.meta?.Date ||
        parseTimestamp(item.timestamp),
      otp: detail.possibleOtp || null,
      links: detail.links || [],
      text: detail.text,
      html: detail.html
    });
  }

  return success({
    email: `${clean}@${DOMAIN}`,
    total: messages.length,
    messages
  });
}

const ENDPOINTS = {
  'GET /api/gen': 'Generate new random disposable email',
  'GET /api/use?user=<name>': 'Format a custom email address',
  'GET /api/inbox?user=<name>': 'Get inbox message list',
  'GET /api/read?user=<name>&index=<1|key>': 'Read an email',
  'GET /api/dump?user=<name>': 'Read all messages',
  'GET /api/stream?user=<name>': 'Stream new messages with SSE'
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

function getPathUser(pathname, prefix) {
  if (!pathname.startsWith(prefix)) return null;

  const value = pathname.slice(prefix.length).split('/')[0];
  return value ? decodeURIComponent(value) : null;
}

async function handleApi(request) {
  const requestUrl = new URL(request.url);
  const pathname =
    requestUrl.pathname.replace(/\/+$/, '') || '/';

  if (pathname === '/' || pathname === '/api') {
    return jsonResponse(success({
      message: 'Akunlama REST API by Lann',
      endpoints: ENDPOINTS
    }));
  }

  if (pathname === '/api/gen') {
    return jsonResponse(opGenerate());
  }

  if (
    pathname === '/api/use' ||
    pathname.startsWith('/api/use/')
  ) {
    const user =
      requestUrl.searchParams.get('user') ||
      requestUrl.searchParams.get('email') ||
      requestUrl.searchParams.get('name') ||
      getPathUser(pathname, '/api/use/');

    if (!user) {
      return jsonResponse(
        error('Parameter "user" is required. Usage: /api/use/:name'),
        400
      );
    }

    return jsonResponse(opUse(user));
  }

  if (
    pathname === '/api/inbox' ||
    pathname.startsWith('/api/inbox/')
  ) {
    const user =
      requestUrl.searchParams.get('user') ||
      getPathUser(pathname, '/api/inbox/');

    if (!user) {
      return jsonResponse(
        error('Parameter "user" is required'),
        400
      );
    }

    const result = await opInbox(user);

    return jsonResponse(
      result,
      result.status === 'success' ? 200 : 400
    );
  }

  if (
    pathname === '/api/read' ||
    pathname.startsWith('/api/read/')
  ) {
    let user = requestUrl.searchParams.get('user');
    let index =
      requestUrl.searchParams.get('index') ||
      requestUrl.searchParams.get('key') ||
      requestUrl.searchParams.get('id') ||
      '1';

    if (pathname.startsWith('/api/read/')) {
      const parts = pathname.split('/');
      user = parts[3] ? decodeURIComponent(parts[3]) : user;

      if (parts[4]) {
        index = decodeURIComponent(parts[4]);
      }
    }

    if (!user) {
      return jsonResponse(
        error('Parameter "user" is required'),
        400
      );
    }

    const result = await opRead(user, index);

    return jsonResponse(
      result,
      result.status === 'success' ? 200 : 404
    );
  }

  if (
    pathname === '/api/dump' ||
    pathname.startsWith('/api/dump/')
  ) {
    const user =
      requestUrl.searchParams.get('user') ||
      getPathUser(pathname, '/api/dump/');

    if (!user) {
      return jsonResponse(
        error('Parameter "user" is required'),
        400
      );
    }

    const result = await opDump(user);

    return jsonResponse(
      result,
      result.status === 'success' ? 200 : 400
    );
  }

  if (
    pathname === '/api/stream' ||
    pathname.startsWith('/api/stream/')
  ) {
    const user =
      requestUrl.searchParams.get('user') ||
      getPathUser(pathname, '/api/stream/');

    if (!user) {
      return jsonResponse(
        error('Parameter "user" is required for stream'),
        400
      );
    }

    return createStreamResponse(
      cleanRecipient(user),
      requestUrl.searchParams
    );
  }

  return jsonResponse(
    error(`Endpoint '${pathname}' not found`),
    404
  );
}

function createStreamResponse(username, searchParams) {
  const intervalValue =
    Number.parseInt(searchParams.get('interval') || '5', 10);

  const intervalSec = Math.min(
    60,
    Math.max(
      1,
      Number.isFinite(intervalValue) ? intervalValue : 5
    )
  );

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let knownKeys = new Set();

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      };

      try {
        const initial = await listInbox(username);

        for (const message of initial) {
          const key = message.storage?.key;
          if (key) knownKeys.add(key);
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify(success({
              status: 'connected',
              email: `${username}@${DOMAIN}`
            }))}\n\n`
          )
        );

        while (!closed) {
          await new Promise(resolve =>
            setTimeout(resolve, intervalSec * 1000)
          );

          if (closed) break;

          try {
            const messages = await listInbox(username);

            for (const message of messages) {
              const key = message.storage?.key;

              if (!key || knownKeys.has(key)) continue;

              knownKeys.add(key);

              const detail = await getEmailDetail(
                message.storage?.region || 'us',
                key
              );

              const payload = success({
                event: 'new_email',
                email: `${username}@${DOMAIN}`,
                data: {
                  id: key,
                  region: message.storage?.region || 'us',
                  from: detail.meta?.name
                    ? `${detail.meta.name} <${detail.meta.emailAddress}>`
                    : (detail.meta?.emailAddress || null),
                  subject:
                    detail.meta?.subject ||
                    '(No Subject)',
                  date:
                    detail.meta?.Date ||
                    new Date().toISOString(),
                  otp: detail.possibleOtp || null,
                  links: detail.links || [],
                  text: detail.text,
                  html: detail.html
                }
              });

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
              );
            }
          } catch {
            // Keep the stream alive when an upstream poll fails.
          }
        }
      } catch (err) {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify(error(err.message))}\n\n`
            )
          );
        } catch {}
      } finally {
        close();
      }
    },

    cancel() {
      // The stream is cancelled when the client disconnects.
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return optionsResponse();
    }

    if (request.method !== 'GET') {
      return jsonResponse(
        error('Method not allowed. Use GET.'),
        405
      );
    }

    try {
  const url = new URL(request.url);

  // API tetap menggunakan Worker
  if (url.pathname.startsWith('/api')) {
    return await handleApi(request);
  }

  // Selain /api → tampilkan website dari /public
  return await env.ASSETS.fetch(request);
} catch (err) {
      return jsonResponse(
        error(err instanceof Error ? err.message : String(err)),
        500
      );
    }
  }
};
