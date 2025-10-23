// server/server.js

const express = require('express');
const cors = require('cors');
const { faker } = require('@faker-js/faker');
const { nanoid } = require('nanoid');
require('dotenv').config(); // <-- load env vars at the very top


const app = express();
const PORT = process.env.PORT || 4000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- In-Memory "Database" ---
let contacts = [];

/**
 * A helper function to sort contacts by name, alphabetically.
 */
const sortContacts = (contactsList) => {
  return contactsList.sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Generates 5,000 mock contacts and stores them in memory.
 */
const generateMockData = () => {
  console.log('Generating 5,000 mock contacts...');
  const newContacts = [];
  for (let i = 0; i < 5000; i++) {
    newContacts.push({
      id: nanoid(10),
      name: faker.person.fullName(),
      phone: faker.phone.number(),
      // We'll make the email unique to avoid issues
      email: faker.internet.email({
        firstName: `user_${i}`,
        provider: 'example.com',
      }).toLowerCase(),
      imageUrl: Math.random() > 0.5 ? faker.image.avatar() : null,
      isFavorite: false,
    });
  }
  contacts = sortContacts(newContacts);
  console.log('Mock data generation complete.');
};

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- API Endpoints (The "Routes") ---

/**
 * [GET] /api/contacts
 *
 * This is the new, paginated endpoint.
 * It supports server-side search, pagination, and sorting.
 *
 * Query Params:
 * - ?page=1     (The page number to fetch, default 1)
 * - ?limit=50   (The number of items per page, default 50)
 * - ?search=john (The search term to filter by name, email, or phone)
 */
app.get('/api/contacts', (req, res) => {
  // 1. Get query params with safe defaults
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50; // Default to 50 items
  const search = (req.query.search || '').toLowerCase();

  // 2. Filter the list (if a search query exists)
  // We search by name, email, and phone
  const filteredContacts = search
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.phone.includes(search) || // Phone numbers don't need .toLowerCase()
          c.email.toLowerCase().includes(search)
      )
    : contacts; // If no search, use the full list

  // 3. Get total count *after* filtering
  const totalCount = filteredContacts.length;

  // 4. Paginate the filtered list
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

  // 5. Simulate a realistic network delay (makes loading states visible)
  
    // 6. Send the response object
    res.json({
      // The contacts for the requested page
      contacts: paginatedContacts,
      // The total number of *filtered* contacts (not 5000)
      totalCount: totalCount,
      totalCount: totalCount,
      // The current page number
      page: page,
      // A boolean to tell the client if there's more data to load
      hasNextPage: endIndex < totalCount,
    });

    console.log(
      `GET /api/contacts?page=${page}&limit=${limit}&search=${search} - Sent ${paginatedContacts.length} of ${totalCount} results`
    );
  
});

/**
 * [POST] /api/contacts
 * Creates a new contact, adds it to the list, re-sorts,
 * and returns the new contact.
 */
app.post('/api/contacts', (req, res) => {
  const { name, phone, email, imageUrl } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ message: 'Name and phone are required.' });
  }

  const newContact = {
    id: nanoid(10),
    name,
    phone,
    email: email || null,
    imageUrl: imageUrl || null,
    isFavorite: false,
  };

  contacts.push(newContact);
  contacts = sortContacts(contacts); // Re-sort the master list

  console.log(`POST /api/contacts - Added: ${name}`);
  res.status(201).json(newContact);
});

/**
 * [PUT] /api/contacts/:id
 * Updates a contact (e.g., toggling favorite).
 */
app.put('/api/contacts/:id', (req, res) => {
  const { id } = req.params;
  const { isFavorite } = req.body; // Only update what's passed

  let updatedContact = null;

  contacts = contacts.map((contact) => {
    if (contact.id === id) {
      updatedContact = {
        ...contact,
        isFavorite:
          isFavorite === undefined ? contact.isFavorite : isFavorite,
      };
      return updatedContact;
    }
    return contact;
  });

  if (updatedContact) {
    console.log(`PUT /api/contacts/${id} - Updated favorite: ${isFavorite}`);
    res.json(updatedContact);
  } else {
    res.status(404).json({ message: 'Contact not found' });
  }
});

/**
 * [DELETE] /api/contacts/:id
 * Deletes a contact from the list.
 */
app.delete('/api/contacts/:id', (req, res) => {
  const { id } = req.params;
  const contactIndex = contacts.findIndex((c) => c.id === id);

  if (contactIndex === -1) {
    return res.status(404).json({ message: 'Contact not found' });
  }

  // Get the contact before we delete it (for the "Undo" feature)
  const deletedContact = contacts[contactIndex];

  contacts.splice(contactIndex, 1);

  console.log(`DELETE /api/contacts/${id} - Removed: ${deletedContact.name}`);

  // Send back the contact that was deleted.
  // The client will use this for the "Undo" feature.
  res.json(deletedContact);
});

// --- Start the Server ---

const axios = require("axios");

// Ping your own Render app every 5 minutes
const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000; // 5 minutes

if (process.env.RENDER_EXTERNAL_URL) {
  setInterval(async () => {
    try {
      const res = await axios.get(`${process.env.RENDER_EXTERNAL_URL}/health`);
      console.log("✅ Keep-alive ping:", res.status, new Date().toISOString());
    } catch (err) {
      console.error("⚠️ Keep-alive failed:", err.message);
    }
  }, KEEP_ALIVE_INTERVAL);
}


generateMockData(); // 1. Generate data
app.listen(PORT, () => {
  // 2. Start server
  console.log(`🚀 Contact API Server running at http://localhost:${PORT}`);
});