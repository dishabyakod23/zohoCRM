const pool = require('./pool');
require('dotenv').config();

const initDB = async () => {
  const client = await pool.connect();
  try {
    console.log('Initializing database...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'sales_rep',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(150),
        phone VARCHAR(30),
        company VARCHAR(150),
        title VARCHAR(100),
        owner_id INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(150),
        phone VARCHAR(30),
        company VARCHAR(150),
        source VARCHAR(80),
        status VARCHAR(50) DEFAULT 'New',
        owner_id INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        industry VARCHAR(100),
        website VARCHAR(200),
        phone VARCHAR(30),
        city VARCHAR(100),
        country VARCHAR(100),
        owner_id INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS deals (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        amount NUMERIC(14,2),
        stage VARCHAR(80) DEFAULT 'Prospecting',
        close_date DATE,
        probability INTEGER DEFAULT 10,
        account_id INTEGER REFERENCES accounts(id),
        contact_id INTEGER REFERENCES contacts(id),
        owner_id INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        subject VARCHAR(200),
        description TEXT,
        status VARCHAR(50) DEFAULT 'Open',
        due_date TIMESTAMPTZ,
        related_type VARCHAR(50),
        related_id INTEGER,
        owner_id INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Seed demo user
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('demo1234', 10);
    await client.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Disha Rao', 'disha@demo.com', $1, 'admin')
      ON CONFLICT (email) DO NOTHING;
    `, [hash]);

    const userRes = await client.query(`SELECT id FROM users WHERE email='disha@demo.com'`);
    const userId = userRes.rows[0].id;

    // Seed accounts
    await client.query(`
      INSERT INTO accounts (name, industry, website, phone, city, country, owner_id) VALUES
      ('Tata Consultancy Services', 'IT Services', 'https://tcs.com', '+91-22-67789999', 'Mumbai', 'India', $1),
      ('Flipkart', 'E-Commerce', 'https://flipkart.com', '+91-80-49401212', 'Bangalore', 'India', $1),
      ('Infosys BPM', 'IT Services', 'https://infosysbpm.com', '+91-80-22700000', 'Bangalore', 'India', $1),
      ('Ola Electric', 'Automotive', 'https://olaelectric.com', '+91-80-47104710', 'Bangalore', 'India', $1),
      ('Byju''s Learning', 'EdTech', 'https://byjus.com', '+91-80-47190419', 'Bangalore', 'India', $1)
      ON CONFLICT DO NOTHING;
    `, [userId]);

    // Seed contacts
    await client.query(`
      INSERT INTO contacts (first_name, last_name, email, phone, company, title, owner_id) VALUES
      ('Priya', 'Nair', 'priya@tcs.com', '+91-9876543210', 'Tata Consultancy Services', 'VP Sales', $1),
      ('Arjun', 'Mehta', 'a.mehta@flipkart.com', '+91-9123456789', 'Flipkart', 'Director Procurement', $1),
      ('Vikram', 'Sinha', 'v.sinha@infosys.com', '+91-9988776655', 'Infosys BPM', 'Head of Operations', $1),
      ('Ananya', 'Rao', 'ananya@byjus.com', '+91-9871234567', 'Byju''s Learning', 'Chief Revenue Officer', $1),
      ('Saurabh', 'Jain', 's.jain@olaelectric.com', '+91-9765432109', 'Ola Electric', 'GM Partnerships', $1)
      ON CONFLICT DO NOTHING;
    `, [userId]);

    // Seed leads
    await client.query(`
      INSERT INTO leads (first_name, last_name, email, phone, company, source, status, owner_id) VALUES
      ('Rohit', 'Sharma', 'rohit@zepto.in', '+91-9812345678', 'Zepto', 'Website', 'New', $1),
      ('Kavita', 'Desai', 'kavita@swiggy.in', '+91-9923456789', 'Swiggy', 'LinkedIn', 'Contacted', $1),
      ('Manish', 'Gupta', 'manish@zomato.com', '+91-9834567890', 'Zomato', 'Cold Call', 'Qualified', $1),
      ('Sneha', 'Patil', 'sneha@meesho.com', '+91-9745678901', 'Meesho', 'Referral', 'New', $1),
      ('Deepak', 'Verma', 'deepak@razorpay.com', '+91-9656789012', 'Razorpay', 'Trade Show', 'Contacted', $1),
      ('Pooja', 'Iyer', 'pooja@paytm.com', '+91-9567890123', 'Paytm', 'Website', 'New', $1)
      ON CONFLICT DO NOTHING;
    `, [userId]);

    // Seed deals
    const acctRes = await client.query(`SELECT id FROM accounts LIMIT 5`);
    const acctIds = acctRes.rows.map(r => r.id);
    await client.query(`
      INSERT INTO deals (name, amount, stage, close_date, probability, account_id, owner_id) VALUES
      ('TCS Enterprise License', 1200000, 'Prospecting', '2025-09-30', 20, $2, $1),
      ('Flipkart Annual Contract', 980000, 'Qualification', '2025-08-15', 40, $3, $1),
      ('Infosys BPM Renewal', 710000, 'Proposal Sent', '2025-07-31', 60, $4, $1),
      ('Ola Electric Pilot', 560000, 'Negotiation', '2025-07-10', 75, $5, $1),
      ('Byju''s Platform Deal', 320000, 'Closed Won', '2025-06-01', 100, $6, $1)
      ON CONFLICT DO NOTHING;
    `, [userId, ...acctIds]);

    // Seed activities
    await client.query(`
      INSERT INTO activities (type, subject, description, status, due_date, related_type, owner_id) VALUES
      ('Call', 'Follow-up with Arjun Mehta', 'Discussed pricing for Q3 deal', 'Completed', NOW() - INTERVAL '2 hours', 'contact', $1),
      ('Meeting', 'Demo for Flipkart team', 'Product demo scheduled with procurement', 'Open', NOW() + INTERVAL '2 days', 'deal', $1),
      ('Email', 'Proposal sent to Vikram Sinha', 'Sent detailed proposal deck for Infosys renewal', 'Completed', NOW() - INTERVAL '1 day', 'contact', $1),
      ('Call', 'Discovery call with Rohit Sharma', 'Initial qualification call - interested in enterprise plan', 'Open', NOW() + INTERVAL '1 day', 'lead', $1),
      ('Task', 'Update CRM data for Q2', 'Clean up stale leads and update deal stages', 'Open', NOW() + INTERVAL '3 days', NULL, $1)
      ON CONFLICT DO NOTHING;
    `, [userId]);

    console.log('✅ Database initialized successfully!');
    console.log('📧 Demo login: disha@demo.com / demo1234');
  } catch (err) {
    console.error('Error initializing DB:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

initDB().catch(console.error);
