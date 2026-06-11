const pool = require('./pool');
require('dotenv').config();

const migrate = async () => {
  const client = await pool.connect();
  try {
    console.log('Running database migration...');

    await client.query(`
      -- Users extensions
      ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_report_enabled BOOLEAN DEFAULT true;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      -- Soft delete + audit columns on core tables
      DO $$ DECLARE t TEXT; BEGIN
        FOREACH t IN ARRAY ARRAY['leads','contacts','accounts','deals','users'] LOOP
          EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ', t);
          EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)', t);
          EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id)', t);
        END LOOP;
      END $$;

      -- Leads extended fields
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS title VARCHAR(100);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS mobile VARCHAR(30);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS annual_revenue NUMERIC(14,2);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN DEFAULT false;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS fax VARCHAR(30);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS website VARCHAR(200);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS rating VARCHAR(50);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS skype_id VARCHAR(100);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS secondary_email VARCHAR(150);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS twitter VARCHAR(100);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS employees INTEGER;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS street VARCHAR(200);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS city VARCHAR(100);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS state VARCHAR(100);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS country VARCHAR(100);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS zip VARCHAR(20);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted BOOLEAN DEFAULT false;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

      -- Contacts extended fields
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS salutation VARCHAR(20);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS department VARCHAR(100);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS mobile VARCHAR(30);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS secondary_email VARCHAR(150);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_source VARCHAR(80);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS reports_to_id INTEGER REFERENCES contacts(id);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS date_of_birth DATE;
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS fax VARCHAR(30);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS website VARCHAR(200);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS skype_id VARCHAR(100);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS twitter VARCHAR(100);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS mailing_street VARCHAR(200);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS mailing_city VARCHAR(100);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS mailing_state VARCHAR(100);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS mailing_country VARCHAR(100);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS mailing_zip VARCHAR(20);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS other_street VARCHAR(200);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS other_city VARCHAR(100);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS other_state VARCHAR(100);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS other_country VARCHAR(100);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS other_zip VARCHAR(20);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);

      -- Accounts extended fields
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_site VARCHAR(150);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS parent_account_id INTEGER REFERENCES accounts(id);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_number VARCHAR(50);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_type VARCHAR(80);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS annual_revenue NUMERIC(14,2);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS rating VARCHAR(50);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS fax VARCHAR(30);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ticker_symbol VARCHAR(20);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ownership VARCHAR(80);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS employees INTEGER;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sic_code VARCHAR(20);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_street VARCHAR(200);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_city VARCHAR(100);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_state VARCHAR(100);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_country VARCHAR(100);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_zip VARCHAR(20);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS shipping_street VARCHAR(200);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(100);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS shipping_state VARCHAR(100);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(100);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS shipping_zip VARCHAR(20);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);

      -- Deals extended fields
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_type VARCHAR(80);
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS lead_source VARCHAR(80);
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS campaign_source VARCHAR(150);
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS contact_role VARCHAR(100);
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);

      -- Tasks
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        due_date TIMESTAMPTZ NOT NULL,
        assigned_to INTEGER REFERENCES users(id) NOT NULL,
        status VARCHAR(50) DEFAULT 'Not Started',
        priority VARCHAR(20) DEFAULT 'Normal',
        related_type VARCHAR(50),
        related_id INTEGER,
        contact_id INTEGER REFERENCES contacts(id),
        description TEXT,
        owner_id INTEGER REFERENCES users(id),
        created_by INTEGER REFERENCES users(id),
        updated_by INTEGER REFERENCES users(id),
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Meetings
      CREATE TABLE IF NOT EXISTS meetings (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        from_datetime TIMESTAMPTZ NOT NULL,
        to_datetime TIMESTAMPTZ NOT NULL,
        host_id INTEGER REFERENCES users(id) NOT NULL,
        participants INTEGER[],
        location VARCHAR(200),
        description TEXT,
        related_type VARCHAR(50),
        related_id INTEGER,
        reminder TIMESTAMPTZ,
        owner_id INTEGER REFERENCES users(id),
        created_by INTEGER REFERENCES users(id),
        updated_by INTEGER REFERENCES users(id),
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Calls
      CREATE TABLE IF NOT EXISTS calls (
        id SERIAL PRIMARY KEY,
        subject VARCHAR(200) NOT NULL,
        call_type VARCHAR(20) NOT NULL,
        status VARCHAR(50) DEFAULT 'Scheduled',
        start_time TIMESTAMPTZ NOT NULL,
        duration INTEGER,
        assigned_to INTEGER REFERENCES users(id) NOT NULL,
        related_type VARCHAR(50),
        related_id INTEGER,
        description TEXT,
        owner_id INTEGER REFERENCES users(id),
        created_by INTEGER REFERENCES users(id),
        updated_by INTEGER REFERENCES users(id),
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Campaigns
      CREATE TABLE IF NOT EXISTS campaigns (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        type VARCHAR(80) NOT NULL,
        status VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        expected_revenue NUMERIC(14,2),
        budgeted_cost NUMERIC(14,2),
        actual_cost NUMERIC(14,2),
        expected_response NUMERIC(5,2),
        numbers_sent INTEGER DEFAULT 0,
        owner_id INTEGER REFERENCES users(id) NOT NULL,
        description TEXT,
        created_by INTEGER REFERENCES users(id),
        updated_by INTEGER REFERENCES users(id),
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS campaign_members (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
        member_type VARCHAR(20) NOT NULL,
        member_id INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'Sent',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(campaign_id, member_type, member_id)
      );

      -- Documents
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        file_path VARCHAR(500) NOT NULL,
        file_type VARCHAR(100),
        file_size INTEGER,
        folder VARCHAR(100),
        owner_id INTEGER REFERENCES users(id),
        related_type VARCHAR(50),
        related_id INTEGER,
        created_by INTEGER REFERENCES users(id),
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Visits
      CREATE TABLE IF NOT EXISTS visits (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        visit_date TIMESTAMPTZ NOT NULL,
        location VARCHAR(200),
        status VARCHAR(50) DEFAULT 'Planned',
        related_type VARCHAR(50),
        related_id INTEGER,
        description TEXT,
        owner_id INTEGER REFERENCES users(id),
        created_by INTEGER REFERENCES users(id),
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Projects
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        status VARCHAR(50) DEFAULT 'In Progress',
        start_date DATE,
        end_date DATE,
        account_id INTEGER REFERENCES accounts(id),
        deal_id INTEGER REFERENCES deals(id),
        description TEXT,
        owner_id INTEGER REFERENCES users(id),
        created_by INTEGER REFERENCES users(id),
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Notes
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        related_type VARCHAR(50) NOT NULL,
        related_id INTEGER NOT NULL,
        owner_id INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Audit log
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        record_type VARCHAR(50) NOT NULL,
        record_id INTEGER NOT NULL,
        action VARCHAR(50) NOT NULL,
        field_name VARCHAR(100),
        old_value TEXT,
        new_value TEXT,
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Settings
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Weekly report log
      CREATE TABLE IF NOT EXISTS weekly_report_logs (
        id SERIAL PRIMARY KEY,
        recipient_email VARCHAR(150),
        recipient_id INTEGER REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'Sent',
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        error_message TEXT
      );

      -- Full-text search indexes
      CREATE INDEX IF NOT EXISTS idx_leads_search ON leads USING gin(to_tsvector('english', coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(company,'')));
      CREATE INDEX IF NOT EXISTS idx_contacts_search ON contacts USING gin(to_tsvector('english', coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(email,'')));
      CREATE INDEX IF NOT EXISTS idx_accounts_search ON accounts USING gin(to_tsvector('english', coalesce(name,'') || ' ' || coalesce(industry,'')));
      CREATE INDEX IF NOT EXISTS idx_deals_search ON deals USING gin(to_tsvector('english', coalesce(name,'')));
    `);

    // Seed additional users for roles
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('demo1234', 10);
    await client.query(`UPDATE users SET role = 'super_admin' WHERE email = 'disha@demo.com'`);
    await client.query(`
      INSERT INTO users (name, email, password_hash, role) VALUES
        ('Sales Manager', 'manager@demo.com', $1, 'sales_manager'),
        ('Sales Rep', 'rep@demo.com', $1, 'sales_rep'),
        ('Viewer User', 'viewer@demo.com', $1, 'viewer')
      ON CONFLICT (email) DO NOTHING
    `, [hash]);

    // Seed tasks, meetings, calls, campaigns if empty
    const taskCount = await client.query(`SELECT COUNT(*) FROM tasks`);
    if (parseInt(taskCount.rows[0].count) === 0) {
      const userRes = await client.query(`SELECT id FROM users WHERE email='disha@demo.com'`);
      const uid = userRes.rows[0]?.id;
      if (uid) {
        await client.query(`INSERT INTO tasks (title, due_date, assigned_to, status, priority, owner_id, created_by) VALUES
          ('Follow up with TCS', NOW() + INTERVAL '1 day', $1, 'Not Started', 'High', $1, $1),
          ('Send proposal to Flipkart', NOW() + INTERVAL '2 days', $1, 'In Progress', 'Normal', $1, $1),
          ('Review Q2 pipeline', NOW() - INTERVAL '1 day', $1, 'Not Started', 'Normal', $1, $1)`, [uid]);
        await client.query(`INSERT INTO meetings (title, from_datetime, to_datetime, host_id, location, owner_id, created_by) VALUES
          ('Q3 Planning', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '1 hour', $1, 'Conference Room A', $1, $1),
          ('Client Demo - Infosys', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days' + INTERVAL '2 hours', $1, 'Zoom', $1, $1)`, [uid]);
        await client.query(`INSERT INTO calls (subject, call_type, start_time, assigned_to, owner_id, created_by) VALUES
          ('Discovery call - Zepto', 'Outbound', NOW() - INTERVAL '2 hours', $1, $1, $1),
          ('Support call - Flipkart', 'Inbound', NOW() - INTERVAL '1 day', $1, $1, $1)`, [uid]);
        await client.query(`INSERT INTO campaigns (name, type, status, start_date, end_date, expected_revenue, owner_id, created_by) VALUES
          ('Q3 Email Blast', 'Email', 'Active', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 500000, $1, $1),
          ('LinkedIn Outreach', 'Social', 'Planning', CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '60 days', 300000, $1, $1)`, [uid]);
      }
    }

    await client.query(`
      INSERT INTO settings (key, value) VALUES
        ('weekly_report', '{"enabled": true, "day": "Monday", "time": "08:00", "timezone": "Asia/Kolkata", "company_name": "Internal CRM"}'),
        ('recycle_bin_days', '30')
      ON CONFLICT (key) DO NOTHING;
    `);

    console.log('✅ Migration completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

migrate().catch(console.error);
