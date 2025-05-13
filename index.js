const express = require('express')
const path = require('path')

const port = process.env.PORT || 5006

const app = express()

app.use(express.static(path.join(__dirname, 'public')))
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

app.get('/', (req, res) => {
  console.log(`Rendering 'pages/index' for route '/'`)
  res.render('pages/index')
})

app.get('/main', (req, res) => {
  console.log(`Rendering 'pages/saved_items' for route '/main'`)
  
  // Sample data for savedItems
  const savedItems = [
    { name: 'Item 1', description: 'Description for item 1' },
    { name: 'Item 2', description: 'Description for item 2' },
    { name: 'Item 3', description: 'Description for item 3' }
  ];
  
  res.render('pages/saved_items', { savedItems: savedItems })
})

const server = app.listen(port, () => {
  console.log(`Listening on ${port}`)
})

process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: gracefully shutting down')
  if (server) {
    server.close(() => {
      console.log('HTTP server closed')
    })
  }
})
