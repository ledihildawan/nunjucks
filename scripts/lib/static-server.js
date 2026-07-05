import connect from 'connect';
import getPort from 'get-port';
import serveStatic from 'serve-static';
import http from 'http';
import path from 'path';

const __dirname = import.meta.dirname;

function getStaticServer(port) {
  const staticRoot = path.join(__dirname, '../..');
  const portPromise = (typeof port === 'undefined') ? getPort() : Promise.resolve(port);
  return portPromise.then((port) => {
    return new Promise((resolve, reject) => {
      try {
        const app = connect().use(serveStatic(staticRoot));
        const server = http.createServer(app);
        server.listen(port, () => {
          console.log('Test server listening on port ' + port);
          resolve([server, port]);
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

export default getStaticServer;
