// server/server.js

const express = require('express');
const cors = require('cors');
const { faker } = require('@faker-js/faker');
const { nanoid } = require('nanoid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- In-Memory "Database" ---
let contacts = [];
// This list will hold our user-created tags
let availableTags = ['Family', 'Work', 'Friend'];

const sortContacts = (contactsList) => {
  return contactsList.sort((a, b) => a.name.localeCompare(b.name));
};

const generateMockData = () => {
  console.log('Generating 5,000 mock contacts...');
  const newContacts = [];
  for (let i = 0; i < 5000; i++) {
    // Randomly assign some tags
    let tags = [];
    if (Math.random() > 0.8) tags.push('Family');
    if (Math.random() > 0.7) tags.push('Work');
    if (Math.random() > 0.9) tags.push('Friend');

    newContacts.push({
      id: nanoid(10),
      name: faker.person.fullName(),
      phone: faker.phone.number(),
      email: faker.internet.email({
        firstName: `user_${i}`,
        provider: 'example.com',
      }).toLowerCase(),
      imageUrl: Math.random() > 0.5 ? faker.image.avatar() : null,
      isFavorite: Math.random() > 0.9, // 10% are favorite
      tags: tags, // Add the new tags array
    });
  }
  contacts = sortContacts(newContacts);
  console.log('Mock data generation complete.');
};

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- API Endpoints ---

/**
 * [GET] /api/tags
 * Returns the list of available tags.
 */
app.get('/api/tags', (req, res) => {
  res.json(availableTags);
});

/**
 * [POST] /api/tags
 * Creates a new tag and adds it to the list.
 */
app.post('/api/tags', (req, res) => {
  const { tagName } = req.body;
  if (!tagName || typeof tagName !== 'string') {
    return res.status(400).json({ message: 'tagName (string) is required.' });
  }

  const newTag = tagName.trim();
  if (!availableTags.includes(newTag)) {
    availableTags.push(newTag);
    availableTags.sort(); // Keep them alphabetical
    console.log(`POST /api/tags - Added: ${newTag}`);
  }
  res.status(201).json(availableTags);
});

/**
 * [GET] /api/contacts
 * UPDATED to filter by tag.
 *
 * Query Params:
 * - ?page=1
 * - ?limit=50
 * - ?search=john
 * - ?tag=Work (New)
 */
app.get('/api/contacts', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const search = (req.query.search || '').toLowerCase();
  const tag = req.query.tag; // 'All', 'Favourite', or a custom tag

  // 1. Filter by search
  let filteredContacts = search
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.phone.includes(search) ||
          (c.email && c.email.toLowerCase().includes(search))
      )
    : [...contacts]; // Use a copy

  // 2. Filter by tag
  if (tag && tag !== 'All') {
    if (tag === 'Favourite') {
      filteredContacts = filteredContacts.filter((c) => c.isFavorite);
    } else {
      filteredContacts = filteredContacts.filter((c) => c.tags.includes(tag));
    }
  }

  // 3. Paginate
  const totalCount = filteredContacts.length;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

  // 4. Send response
  res.json({
    contacts: paginatedContacts,
    totalCount: totalCount,
    page: page,
    hasNextPage: endIndex < totalCount,
  });

  console.log(
    `GET /api/contacts?page=${page}&limit=${limit}&search=${search}&tag=${tag} - Sent ${paginatedContacts.length} of ${totalCount} results`
  );
});

/**
 * [POST] /api/contacts
 * Creates a new contact.
 */
app.post('/api/contacts', (req, res) => {
  const { name, phone, email, imageUrl, tags = [] } = req.body;

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
    tags: Array.isArray(tags) ? tags : [], // Ensure tags is an array
  };

  contacts.push(newContact);
  contacts = sortContacts(contacts);

  console.log(`POST /api/contacts - Added: ${name}`);
  res.status(201).json(newContact);
});

/**
 * [PUT] /api/contacts/:id
 * UPDATED to handle 'isFavorite' OR 'tags'.
 */
app.put('/api/contacts/:id', (req, res) => {
  const { id } = req.params;
  const { isFavorite, tags } = req.body;

  let updatedContact = null;

  contacts = contacts.map((contact) => {
    if (contact.id === id) {
      updatedContact = {
        ...contact,
        // Only update isFavorite if it was provided
        isFavorite:
          isFavorite === undefined ? contact.isFavorite : isFavorite,
        // Only update tags if it was provided
        tags: tags === undefined ? contact.tags : tags,
      };
      return updatedContact;
    }
    return contact;
  });

  if (updatedContact) {
    console.log(`PUT /api/contacts/${id} - Updated contact`);
    res.json(updatedContact);
  } else {
    res.status(404).json({ message: 'Contact not found' });
  }
});

/**
 * [DELETE] /api/contacts/:id
 * (No changes needed)
 */
app.delete('/api/contacts/:id', (req, res) => {
  const { id } = req.params;
  const contactIndex = contacts.findIndex((c) => c.id === id);

  if (contactIndex === -1) {
    return res.status(404).json({ message: 'Contact not found' });
  }

  const deletedContact = contacts[contactIndex];
  contacts.splice(contactIndex, 1);
  console.log(`DELETE /api/contacts/${id} - Removed: ${deletedContact.name}`);
  res.json(deletedContact);
});


// --- Start the Server ---
const axios = require("axios");
const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000;
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

generateMockData();
app.listen(PORT, () => {
  console.log(`🚀 Contact API Server running at http://localhost:${PORT}`);
});