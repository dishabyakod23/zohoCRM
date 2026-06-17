const express = require('express');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { getAllLeadStatuses } = require('../utils/leadStatusStore');

const router = express.Router();
router.use(auth);

const ok = (res, data) => res.json({ data });

router.get('/lead-statuses', async (_, res) => {
  try {
    ok(res, await getAllLeadStatuses());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/deal-stages', (_, res) => ok(res, [
  { value: 'qualification', label: 'Qualification' },
  { value: 'needs_analysis', label: 'Needs Analysis' },
  { value: 'value_proposition', label: 'Value Proposition' },
  { value: 'identify_decision_makers', label: 'Id. Decision Makers' },
  { value: 'perception_analysis', label: 'Perception Analysis' },
  { value: 'proposal_price_quote', label: 'Proposal / Price Quote' },
  { value: 'negotiation_review', label: 'Negotiation / Review' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
]));

router.get('/users', async (_, res) => {
  try {
    const result = await pool.query(`SELECT id, name, email, role FROM users WHERE deleted_at IS NULL ORDER BY name`);
    ok(res, result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/accounts', async (_, res) => {
  try {
    const result = await pool.query(`SELECT id as value, name as label FROM accounts WHERE deleted_at IS NULL ORDER BY name`);
    ok(res, result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/contacts', async (_, res) => {
  try {
    const result = await pool.query(`SELECT id as value, first_name || ' ' || last_name as label FROM contacts WHERE deleted_at IS NULL ORDER BY last_name`);
    ok(res, result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/task-statuses', (_, res) => ok(res, [
  { value: 'not_started', label: 'Not Started' },
  { value: 'deferred', label: 'Deferred' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'waiting_for_input', label: 'Waiting for Input' },
]));

router.get('/task-priorities', (_, res) => ok(res, [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]));

router.get('/call-types', (_, res) => ok(res, [
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
  { value: 'missed', label: 'Missed' },
]));

router.get('/campaign-types', (_, res) => ok(res, [
  { value: 'email', label: 'Email' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'conference', label: 'Conference' },
  { value: 'trade_show', label: 'Trade Show' },
  { value: 'banner_ads', label: 'Banner Ads' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'direct_mail', label: 'Direct Mail' },
]));

router.get('/campaign-statuses', (_, res) => ok(res, [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'complete', label: 'Complete' },
]));

router.get('/project-statuses', (_, res) => ok(res, [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]));

router.get('/visit-statuses', (_, res) => ok(res, [
  { value: 'planned', label: 'Planned' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]));

module.exports = router;
