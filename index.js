const express = require('express')
const path = require('path')
const { Pool } = require('pg')

const port = process.env.PORT || 5006

// Database connection configuration
const isProduction = process.env.NODE_ENV === 'production'
const connectionString = 'postgres://postgres:9d330f79c00fa2c7a144a6dcfeed431a@dokku-postgres-itemdb:5432/itemdb'

// Create a pool - only connects in production environment
let pool
if (isProduction) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || connectionString,
    ssl: {
      rejectUnauthorized: false // Required for Heroku/Dokku PostgreSQL
    }
  })
}

// Initialize database schema
async function initializeDatabaseSchema() {
  if (isProduction && pool) {
    try {
      console.log('Checking and initializing database schema...')
      
      // Create saved_items table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS saved_items (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)
      
      console.log('Database schema initialized successfully')
    } catch (err) {
      console.error('Error initializing database schema:', err)
    }
  }
}

// Mock data for local development
const mockSavedItems = [
  { id: 1, name: 'Item 1', description: 'Description for item 1' },
  { id: 2, name: 'Item 2', description: 'Description for item 2' },
  { id: 3, name: 'Item 3', description: 'Description for item 3' }
]

const app = express()

// Middleware
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json()) // Add middleware to parse JSON bodies
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

// Helper function to get items from database or mock data
async function getSavedItems() {
  if (isProduction && pool) {
    try {
      const result = await pool.query('SELECT * FROM saved_items')
      return result.rows
    } catch (err) {
      console.error('Database query error:', err)
      return mockSavedItems // Fallback to mock data if query fails
    }
  } else {
    // Use mock data when in development
    console.log('Using mock data (not connected to database)')
    return mockSavedItems
  }
}

// Function to get a single item by ID
async function getItemById(id) {
  if (isProduction && pool) {
    try {
      const result = await pool.query('SELECT * FROM saved_items WHERE id = $1', [id])
      return result.rows[0]
    } catch (err) {
      console.error('Database query error:', err)
      return mockSavedItems.find(item => item.id === Number(id))
    }
  } else {
    return mockSavedItems.find(item => item.id === Number(id))
  }
}

// Function to create a new item
async function createItem(item) {
  if (isProduction && pool) {
    try {
      const result = await pool.query(
        'INSERT INTO saved_items(name, description) VALUES($1, $2) RETURNING *',
        [item.name, item.description]
      )
      return result.rows[0]
    } catch (err) {
      console.error('Database insert error:', err)
      throw err
    }
  } else {
    // For development, add to mock data
    const newId = mockSavedItems.length > 0 ? Math.max(...mockSavedItems.map(item => item.id)) + 1 : 1
    const newItem = { id: newId, ...item }
    mockSavedItems.push(newItem)
    return newItem
  }
}

// Function to update an item
async function updateItem(id, item) {
  if (isProduction && pool) {
    try {
      const result = await pool.query(
        'UPDATE saved_items SET name = $1, description = $2 WHERE id = $3 RETURNING *',
        [item.name, item.description, id]
      )
      return result.rows[0]
    } catch (err) {
      console.error('Database update error:', err)
      throw err
    }
  } else {
    // For development, update mock data
    const index = mockSavedItems.findIndex(item => item.id === Number(id))
    if (index !== -1) {
      mockSavedItems[index] = { ...mockSavedItems[index], ...item }
      return mockSavedItems[index]
    }
    return null
  }
}

// Function to delete an item
async function deleteItem(id) {
  if (isProduction && pool) {
    try {
      const result = await pool.query('DELETE FROM saved_items WHERE id = $1 RETURNING *', [id])
      return result.rows[0]
    } catch (err) {
      console.error('Database delete error:', err)
      throw err
    }
  } else {
    // For development, remove from mock data
    const index = mockSavedItems.findIndex(item => item.id === Number(id))
    if (index !== -1) {
      const deletedItem = mockSavedItems[index]
      mockSavedItems.splice(index, 1)
      return deletedItem
    }
    return null
  }
}

// Web page routes
app.get('/', (req, res) => {
  console.log(`Rendering 'pages/index' for route '/'`)
  res.render('pages/index')
})

app.get('/main', (req, res) => {
  console.log(`Rendering 'pages/saved_items' for route '/main'`)
  
  getSavedItems()
    .then(savedItems => {
      res.render('pages/saved_items', { savedItems: savedItems })
    })
    .catch(err => {
      console.error('Error retrieving saved items:', err)
      res.status(500).send('Error retrieving saved items')
    })
})

app.get('/saved-items', (req, res) => {
  console.log(`Rendering 'pages/saved_items' for route '/saved-items'`)
  
  getSavedItems()
    .then(savedItems => {
      res.render('pages/saved_items', { savedItems: savedItems })
    })
    .catch(err => {
      console.error('Error retrieving saved items:', err)
      res.status(500).send('Error retrieving saved items')
    })
})

// API Routes
// GET all items
app.get('/api/items', async (req, res) => {
  try {
    const items = await getSavedItems()
    res.json(items)
  } catch (err) {
    console.error('Error retrieving items:', err)
    res.status(500).json({ error: 'Failed to retrieve items' })
  }
})

// GET single item by ID
app.get('/api/items/:id', async (req, res) => {
  try {
    const item = await getItemById(req.params.id)
    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }
    res.json(item)
  } catch (err) {
    console.error('Error retrieving item:', err)
    res.status(500).json({ error: 'Failed to retrieve item' })
  }
})

// POST create new item
app.post('/api/items', async (req, res) => {
  try {
    const { name, description } = req.body
    
    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required' })
    }
    
    const newItem = await createItem({ name, description })
    res.status(201).json(newItem)
  } catch (err) {
    console.error('Error creating item:', err)
    res.status(500).json({ error: 'Failed to create item' })
  }
})

// PUT update item
app.put('/api/items/:id', async (req, res) => {
  try {
    const { name, description } = req.body
    
    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required' })
    }
    
    const updatedItem = await updateItem(req.params.id, { name, description })
    
    if (!updatedItem) {
      return res.status(404).json({ error: 'Item not found' })
    }
    
    res.json(updatedItem)
  } catch (err) {
    console.error('Error updating item:', err)
    res.status(500).json({ error: 'Failed to update item' })
  }
})

// DELETE item
app.delete('/api/items/:id', async (req, res) => {
  try {
    const deletedItem = await deleteItem(req.params.id)
    
    if (!deletedItem) {
      return res.status(404).json({ error: 'Item not found' })
    }
    
    res.json(deletedItem)
  } catch (err) {
    console.error('Error deleting item:', err)
    res.status(500).json({ error: 'Failed to delete item' })
  }
})

const server = app.listen(port, () => {
  console.log(`Listening on ${port}`)
  // Initialize database schema when server starts
  initializeDatabaseSchema()
})

// Clean shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: gracefully shutting down')
  if (server) {
    server.close(() => {
      console.log('HTTP server closed')
    })
  }
  
  // Close database pool if it exists
  if (pool) {
    await pool.end()
    console.log('Database pool closed')
  }
})
