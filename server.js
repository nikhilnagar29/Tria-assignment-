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
let availableTags = ['Family', 'Work', 'Friend']; // Initial tags

const sortContacts = (contactsList) => {
  // Ensure names exist before comparing
  return contactsList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
};

const generateMockData = () => {
  if (contacts.length > 0) {
      console.log('Mock data already generated.');
      return;
  }
  console.log('Generating 5,000 mock contacts...');
  const newContacts = [];
  for (let i = 0; i < 5000; i++) {
    let tags = [];
    if (Math.random() > 0.8) tags.push('Family');
    if (Math.random() > 0.7) tags.push('Work');
    if (Math.random() > 0.9) tags.push('Friend');

    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    newContacts.push({
      id: nanoid(10),
      name: `${firstName} ${lastName}`,
      phone: faker.phone.number(),
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      imageUrl: Math.random() > 0.6 ? faker.image.avatar() : null, // Increased chance of avatar
      isFavorite: Math.random() > 0.9, // 10% are favorite
      tags: tags,
    });
  }
  contacts = sortContacts(newContacts);
  console.log(`Mock data generation complete. ${contacts.length} contacts loaded.`);
};

// Generate data on server start
generateMockData();

// Health check endpoint for Render keep-alive
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- API Endpoints ---

// [GET] /api/tags - Returns available tags
app.get('/api/tags', (req, res) => {
  res.json(availableTags);
});

// [POST] /api/tags - Creates a new tag
app.post('/api/tags', (req, res) => {
  const { tagName } = req.body;
  if (!tagName || typeof tagName !== 'string' || !tagName.trim()) {
    return res.status(400).json({ message: 'Valid tagName (string) is required.' });
  }

  const newTag = tagName.trim();
  // Case-insensitive check
  if (!availableTags.some(tag => tag.toLowerCase() === newTag.toLowerCase())) {
    availableTags.push(newTag);
    availableTags.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })); // Case-insensitive sort
    console.log(`POST /api/tags - Added: ${newTag}`);
    res.status(201).json(availableTags); // Return updated list
  } else {
    console.log(`POST /api/tags - Tag already exists: ${newTag}`);
    res.status(200).json(availableTags); // Tag exists, return current list
  }
});

// [GET] /api/contacts - Fetches contacts with pagination, search, and tag filtering
app.get('/api/contacts', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const search = (req.query.search || '').toLowerCase().trim();
  const tag = req.query.tag; // 'All', 'Favourite', or a custom tag

  let results = [...contacts]; // Start with a copy of all contacts

  // --- Apply Search Filter ---
  if (search) {
    results = results.filter(contact =>
      (contact.name && contact.name.toLowerCase().includes(search)) ||
      (contact.phone && contact.phone.replace(/\D/g, '').includes(search.replace(/\D/g, ''))) || // Match digits
      (contact.email && contact.email.toLowerCase().includes(search))
    );
  }

  // --- Apply Tag Filter ---
  if (tag && tag !== 'All') {
    if (tag === 'Favourite') {
      results = results.filter(contact => contact.isFavorite);
    } else {
      // Ensure contact.tags exists and is an array before calling includes
      results = results.filter(contact => Array.isArray(contact.tags) && contact.tags.includes(tag));
    }
  }

  // --- Apply Pagination ---
  const totalCount = results.length;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedContacts = results.slice(startIndex, endIndex);

  console.log(
    `GET /api/contacts | page=${page} | limit=${limit} | search="${search}" | tag="${tag}" | Found: ${totalCount} | Sent: ${paginatedContacts.length}`
  );

  res.json({
    contacts: paginatedContacts,
    totalCount: totalCount,
    page: page,
    hasNextPage: endIndex < totalCount,
  });
});

// [POST] /api/contacts - Creates a new contact
app.post('/api/contacts', (req, res) => {
    // Basic validation
    const { name, phone, email = null, imageUrl = null, tags = [] } = req.body;
    if (!name || !phone || !name.trim() || !phone.trim()) {
        return res.status(400).json({ message: 'Name and phone are required.' });
    }

    // Ensure email is valid or null
    const validEmail = email && typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : null;
    const validImageUrl = imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http') ? imageUrl.trim() : null;
    // Ensure tags is an array of strings
    const validTags = Array.isArray(tags) ? tags.filter(tag => typeof tag === 'string' && tag.trim()).map(tag => tag.trim()) : [];

    const newContact = {
        id: nanoid(10),
        name: name.trim(),
        phone: phone.trim(),
        email: validEmail,
        imageUrl: validImageUrl,
        isFavorite: false,
        tags: validTags,
    };

    contacts.push(newContact);
    contacts = sortContacts(contacts); // Keep the list sorted

    console.log(`POST /api/contacts - Added: ${newContact.name} (ID: ${newContact.id})`);
    res.status(201).json(newContact); // Return the created contact
});


// [PUT] /api/contacts/:id - Updates a contact (isFavorite or tags)
app.put('/api/contacts/:id', (req, res) => {
  const { id } = req.params;
  const { isFavorite, tags } = req.body; // Expecting isFavorite (boolean) OR tags (string[])

  let contactFound = false;
  let updatedContact = null;

  contacts = contacts.map((contact) => {
    if (contact.id === id) {
      contactFound = true;
      const updates = {};
      if (typeof isFavorite === 'boolean') {
        updates.isFavorite = isFavorite;
        console.log(`PUT /api/contacts/${id} - Setting isFavorite to ${isFavorite}`);
      }
      if (Array.isArray(tags)) {
        // Validate tags are strings
        updates.tags = tags.filter(tag => typeof tag === 'string' && tag.trim()).map(tag => tag.trim());
        console.log(`PUT /api/contacts/${id} - Setting tags to [${updates.tags.join(', ')}]`);
      } else if (tags !== undefined) {
         // If tags is provided but not an array, it's likely an error or clearing tags
         console.warn(`PUT /api/contacts/${id} - Received non-array for tags, assuming clear tags:`, tags);
         updates.tags = [];
      }

      updatedContact = { ...contact, ...updates };
      return updatedContact;
    }
    return contact;
  });

   // Re-sort if tags were updated, as name might not be unique for sorting anymore
   if (updatedContact && tags !== undefined) {
     contacts = sortContacts(contacts);
   }

  if (contactFound && updatedContact) {
    res.json(updatedContact);
  } else {
     console.error(`PUT /api/contacts/${id} - Contact not found`);
    res.status(404).json({ message: 'Contact not found' });
  }
});


// [DELETE] /api/contacts/:id - Deletes a contact
app.delete('/api/contacts/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = contacts.length;
  const contactToDelete = contacts.find(c => c.id === id); // Find before filtering

  if (!contactToDelete) {
     console.error(`DELETE /api/contacts/${id} - Contact not found`);
    return res.status(404).json({ message: 'Contact not found' });
  }

  contacts = contacts.filter((c) => c.id !== id);

  if (contacts.length < initialLength) {
    console.log(`DELETE /api/contacts/${id} - Removed: ${contactToDelete.name}`);
    res.json(contactToDelete); // Return the deleted contact object
  } else {
     // This case should ideally not happen if findIndex found it, but good practice
     console.error(`DELETE /api/contacts/${id} - Failed to remove contact`);
    res.status(500).json({ message: 'Failed to delete contact' });
  }
});


// --- Server Start & Keep-Alive ---
const axios = require("axios");
const KEEP_ALIVE_INTERVAL = 14 * 60 * 1000; // Ping every 14 minutes for Render free tier

if (process.env.RENDER_EXTERNAL_URL) {
  const healthCheckUrl = `${process.env.RENDER_EXTERNAL_URL}/health`;
  setInterval(async () => {
    try {
      console.log(`Pinging ${healthCheckUrl} to keep alive...`);
      const res = await axios.get(healthCheckUrl);
      console.log("✅ Keep-alive ping successful:", res.status, new Date().toISOString());
    } catch (err) {
      console.error("⚠️ Keep-alive ping failed:", err.message);
    }
  }, KEEP_ALIVE_INTERVAL);
}


app.listen(PORT, () => {
  console.log(`🚀 Contact API Server running at http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
      console.log("⚠️ Development mode: Using in-memory data.");
  }
  if (process.env.RENDER_EXTERNAL_URL) {
      console.log(`🔗 Public URL (Render): ${process.env.RENDER_EXTERNAL_URL}`);
  }
});