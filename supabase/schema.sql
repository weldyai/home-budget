CREATE TABLE expenses (
    id          BIGSERIAL PRIMARY KEY,
    amount      NUMERIC(10,2) NOT NULL,
    currency    TEXT DEFAULT 'MAD',
    category    TEXT NOT NULL,
    subcategory TEXT,
    description TEXT NOT NULL,
    paid_by     TEXT NOT NULL,
    paid_for    TEXT DEFAULT 'both',
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    raw_message TEXT,
    confidence  NUMERIC(3,2)
);

CREATE TABLE budgets (
    id           BIGSERIAL PRIMARY KEY,
    category     TEXT NOT NULL,
    month        TEXT NOT NULL,
    limit_amount NUMERIC(10,2) NOT NULL,
    UNIQUE(category, month)
);

-- Enable Row Level Security
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Allow anon read for webapp
CREATE POLICY "Allow anon read expenses" ON expenses FOR SELECT USING (true);
CREATE POLICY "Allow anon read budgets" ON budgets FOR SELECT USING (true);

-- Allow service_role full access
CREATE POLICY "Allow service_role all expenses" ON expenses USING (auth.role() = 'service_role');
CREATE POLICY "Allow service_role all budgets" ON budgets USING (auth.role() = 'service_role');

-- Enable realtime for webapp subscription
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
