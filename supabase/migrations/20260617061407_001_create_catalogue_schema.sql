-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  short_description TEXT,
  sku TEXT NOT NULL UNIQUE,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  compare_at_price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  weight DECIMAL(8,2),
  dimensions JSONB,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product images table
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product tags table
CREATE TABLE product_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, tag)
);

-- Indexes
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = true;
CREATE INDEX idx_products_featured ON products(is_featured) WHERE is_featured = true;
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_product_images_product ON product_images(product_id);
CREATE INDEX idx_product_tags_product ON product_tags(product_id);
CREATE INDEX idx_product_tags_tag ON product_tags(tag);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tags ENABLE ROW LEVEL SECURITY;

-- Categories: public read, authenticated write
CREATE POLICY "categories_public_select" ON categories FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "categories_authenticated_insert" ON categories FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "categories_authenticated_update" ON categories FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "categories_authenticated_delete" ON categories FOR DELETE
  TO authenticated USING (true);

-- Products: public read, authenticated write
CREATE POLICY "products_public_select" ON products FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "products_authenticated_insert" ON products FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "products_authenticated_update" ON products FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "products_authenticated_delete" ON products FOR DELETE
  TO authenticated USING (true);

-- Product images: public read, authenticated write
CREATE POLICY "product_images_public_select" ON product_images FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "product_images_authenticated_insert" ON product_images FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "product_images_authenticated_update" ON product_images FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "product_images_authenticated_delete" ON product_images FOR DELETE
  TO authenticated USING (true);

-- Product tags: public read, authenticated write
CREATE POLICY "product_tags_public_select" ON product_tags FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "product_tags_authenticated_insert" ON product_tags FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "product_tags_authenticated_update" ON product_tags FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "product_tags_authenticated_delete" ON product_tags FOR DELETE
  TO authenticated USING (true);