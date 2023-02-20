const http = require('http');
const EventEmitter = require('events');

async function serve(handler) {
  const events = new EventEmitter();

  function requestListener(req, res) {
    if (req.url === '/changes') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.writeHead(200);
      const sendEvent = () => res.write('event: change\ndata:\n\n');
      events.on('change', sendEvent);
      req.on('close', () => events.off('change', sendEvent));
      return;
    }

    if (req.url === '/') {
      res.writeHead(200);
      handler().then(
        (content) => res.end(webpage(content)),
        (error) => res.end(webpage(`<pre>${error.message}</pre>`))
      );
      return;
    }

    res.writeHead(404);
    res.end('Not found: ' + req.url);
  }
  const server = http.createServer(requestListener);
  await new Promise((resolve) => server.listen(9901, resolve));

  return {
    notify: () => events.emit('change'),
  };
}

const webpage = (content) => `
<html>
<title>Hot Chain SVG</title>
${content}
<script>
const sse = new EventSource('/changes');
sse.addEventListener('change', () => window.location.reload());
</script>
</html>
`;

module.exports = serve;
