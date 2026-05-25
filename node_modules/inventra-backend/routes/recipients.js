const express = require('express');
const router = express.Router();
const Recipient = require('../models/Recipient');

// Get all recipients
router.get('/', async (req, res) => {
  try {
    const recipients = await Recipient.findAll();
    res.json({ data: recipients });
  } catch (error) {
    console.error('Error fetching recipients:', error);
    res.status(500).json({ 
      error: 'Failed to fetch recipients',
      message: error.message 
    });
  }
});

// Get recipient by ID
router.get('/:id', async (req, res) => {
  try {
    const recipient = await Recipient.findById(req.params.id);
    
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    
    res.json({ data: recipient });
  } catch (error) {
    console.error('Error fetching recipient:', error);
    res.status(500).json({ 
      error: 'Failed to fetch recipient',
      message: error.message 
    });
  }
});

// Create new recipient
router.post('/', async (req, res) => {
  try {
    const recipientId = await Recipient.create(req.body);
    const newRecipient = await Recipient.findById(recipientId);
    
    res.status(201).json({ 
      message: 'Recipient created successfully',
      data: newRecipient 
    });
  } catch (error) {
    console.error('Error creating recipient:', error);
    res.status(500).json({ 
      error: 'Failed to create recipient',
      message: error.message 
    });
  }
});

// Update recipient
router.put('/:id', async (req, res) => {
  try {
    const affectedRows = await Recipient.update(req.params.id, req.body);
    
    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    
    const updatedRecipient = await Recipient.findById(req.params.id);
    
    res.json({ 
      message: 'Recipient updated successfully',
      data: updatedRecipient 
    });
  } catch (error) {
    console.error('Error updating recipient:', error);
    res.status(500).json({ 
      error: 'Failed to update recipient',
      message: error.message 
    });
  }
});

// Delete recipient
router.delete('/:id', async (req, res) => {
  try {
    const affectedRows = await Recipient.delete(req.params.id);
    
    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    
    res.json({ message: 'Recipient deleted successfully' });
  } catch (error) {
    console.error('Error deleting recipient:', error);
    res.status(500).json({ 
      error: 'Failed to delete recipient',
      message: error.message 
    });
  }
});

module.exports = router;
