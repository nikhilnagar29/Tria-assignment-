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
    const name = `${firstName} ${lastName}`; // Generate name first

    newContacts.push({
      id: nanoid(10),
      name: name, // Use generated name
      phone: faker.phone.number(),
      // Ensure email generation uses the same name parts for consistency
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      imageUrl: Math.random() > 0.3 ? faker.image.avatar() : null,
      isFavorite: Math.random() > 0.9,
      tags: tags,
    });
  }
  contacts = sortContacts(newContacts);
  console.log(`Mock data generation complete. ${contacts.length} contacts loaded.`);
};

// Generate data on server start
generateMockData();

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- API Endpoints ---

// [GET] /api/tags
app.get('/api/tags', (req, res) => {
  res.json(availableTags);
});

// [POST] /api/tags
app.post('/api/tags', (req, res) => {
  const { tagName } = req.body;
  if (!tagName || typeof tagName !== 'string' || !tagName.trim()) {
    return res.status(400).json({ message: 'Valid tagName (string) is required.' });
  }
  const newTag = tagName.trim();
  if (!availableTags.some(tag => tag.toLowerCase() === newTag.toLowerCase())) {
    availableTags.push(newTag);
    availableTags.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    console.log(`POST /api/tags - Added: ${newTag}`);
    res.status(201).json(availableTags);
  } else {
    console.log(`POST /api/tags - Tag already exists: ${newTag}`);
    res.status(200).json(availableTags);
  }
});

// [GET] /api/contacts - Fetches contacts with pagination, search, and tag filtering
app.get('/api/contacts', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  // Ensure search term is always defined, lowercase, and trimmed
  const searchTerm = (req.query.search || '').toLowerCase().trim();
  const tag = req.query.tag;

  let results = [...contacts]; // Start with a copy

  // --- Apply Filters ---
  if (searchTerm || (tag && tag !== 'All')) {
    results = results.filter(contact => {
      let matchesSearch = true; // Assume true if no search term
      let matchesTag = true;    // Assume true if tag is 'All' or not provided

      // Check search criteria if searchTerm exists
      if (searchTerm) {
        const nameMatch = contact.name && contact.name.toLowerCase().includes(searchTerm);
        // Clean phone numbers for comparison
        const phoneDigits = (contact.phone || '').replace(/\D/g, '');
        const searchDigits = searchTerm.replace(/\D/g, '');
        const phoneMatch = phoneDigits && searchDigits && phoneDigits.includes(searchDigits);
        const emailMatch = contact.email && contact.email.toLowerCase().includes(searchTerm);

        matchesSearch = !!(nameMatch || phoneMatch || emailMatch); // Use !! to convert truthy/falsy to boolean
      }

      // Check tag criteria if a specific tag is selected
      if (tag && tag !== 'All') {
        if (tag === 'Favourite') {
          matchesTag = contact.isFavorite === true;
        } else {
          matchesTag = Array.isArray(contact.tags) && contact.tags.includes(tag);
        }
      }

      // Contact must match both active filters
      return matchesSearch && matchesTag;
    });
  }

  // --- Apply Pagination ---
  const totalCount = results.length;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedContacts = results.slice(startIndex, endIndex);

  console.log(
    `GET /api/contacts | page=${page} | limit=${limit} | search="${searchTerm}" | tag="${tag}" | Found: ${totalCount} | Sent: ${paginatedContacts.length}`
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
    const { name, phone, email = null, imageUrl = null, tags = [] } = req.body;
    if (!name || !phone || !name.trim() || !phone.trim()) {
        return res.status(400).json({ message: 'Name and phone are required.' });
    }
    const validEmail = email && typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : null;
    const validImageUrl = imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http') ? imageUrl.trim() : null;
    const validTags = Array.isArray(tags) ? tags.filter(tag => typeof tag === 'string' && tag.trim()).map(tag => tag.trim()) : [];
    const newContact = {
        id: nanoid(10), name: name.trim(), phone: phone.trim(), email: validEmail,
        imageUrl: validImageUrl, isFavorite: false, tags: validTags,
    };
    contacts.push(newContact);
    contacts = sortContacts(contacts);
    console.log(`POST /api/contacts - Added: ${newContact.name} (ID: ${newContact.id})`);
    res.status(201).json(newContact);
});

// [PUT] /api/contacts/:id - Updates a contact
app.put('/api/contacts/:id', (req, res) => {
  const { id } = req.params;
  const { isFavorite, tags } = req.body;
  let contactFound = false;
  let updatedContact = null;

  contacts = contacts.map((contact) => {
    if (contact.id === id) {
      contactFound = true;
      const updates = {};
      if (typeof isFavorite === 'boolean') updates.isFavorite = isFavorite;
      if (Array.isArray(tags)) {
          updates.tags = tags.filter(tag => typeof tag === 'string' && tag.trim()).map(tag => tag.trim());
      } else if (tags !== undefined) updates.tags = []; // Clear tags if non-array provided

      updatedContact = { ...contact, ...updates };
      return updatedContact;
    }
    return contact;
  });

   if (updatedContact && tags !== undefined) contacts = sortContacts(contacts);

  if (contactFound && updatedContact) {
    console.log(`PUT /api/contacts/${id} - Updated contact`);
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
  const contactToDelete = contacts.find(c => c.id === id);

  if (!contactToDelete) {
     console.error(`DELETE /api/contacts/${id} - Contact not found`);
    return res.status(404).json({ message: 'Contact not found' });
  }
  contacts = contacts.filter((c) => c.id !== id);
  if (contacts.length < initialLength) {
    console.log(`DELETE /api/contacts/${id} - Removed: ${contactToDelete.name}`);
    res.json(contactToDelete);
  } else {
     console.error(`DELETE /api/contacts/${id} - Failed to remove contact`);
    res.status(500).json({ message: 'Failed to delete contact' });
  }
});

// --- Server Start & Keep-Alive ---
const axios = require("axios");
const KEEP_ALIVE_INTERVAL = 14 * 60 * 1000;

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