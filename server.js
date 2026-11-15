const { createServer } = require('http')
const next = require('next')
const { attachSocket, getJwtKey } = require('./server/socket')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0' // Docker içinde dışarıdan erişilebilmesi için
const port = parseInt(process.env.PORT || '3000', 10)

// Güvenlik ayarları eksikse sunucu hiç başlamaz (sabit yedek anahtar yok).
getJwtKey()

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error('İstek işlenirken hata:', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    })
  })

  // API route'ları yayın yapmak için bu örneğe global üzerinden erişir (src/lib/realtime.ts).
  global.io = attachSocket(httpServer)

  httpServer
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
    })
})
