import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create permissions
  const modules = ['users', 'roles', 'products', 'categories', 'brands', 'stocks', 'customers', 'suppliers', 'purchases', 'sales', 'payments', 'invoices', 'reports', 'settings'];
  const actions = ['create', 'read', 'update', 'delete'];

  for (const module of modules) {
    for (const action of actions) {
      await prisma.permission.upsert({
        where: { name: `${module}:${action}` },
        update: {},
        create: {
          name: `${module}:${action}`,
          description: `${action} ${module}`,
          module,
          action,
        },
      });
    }
  }
  console.log('✅ Permissions created');

  // Create roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN', description: 'Full access administrator' },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'MANAGER' },
    update: {},
    create: { name: 'MANAGER', description: 'Store manager' },
  });

  const cashierRole = await prisma.role.upsert({
    where: { name: 'CASHIER' },
    update: {},
    create: { name: 'CASHIER', description: 'Cashier / Sales' },
  });

  const warehouseRole = await prisma.role.upsert({
    where: { name: 'WAREHOUSE' },
    update: {},
    create: { name: 'WAREHOUSE', description: 'Warehouse keeper' },
  });

  // Assign all permissions to admin
  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }
  console.log('✅ Roles created and permissions assigned');

  // Create admin user
  const hashedPassword = await bcrypt.hash('Admin@123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@quincaillerie.com' },
    update: {},
    create: {
      email: 'admin@quincaillerie.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'System',
      roleId: adminRole.id,
    },
  });
  console.log('✅ Admin user created: admin@quincaillerie.com / Admin@123');



  // Load additional products, categories and brands from products.json if present
  try {
    const productsPath = path.join(__dirname, 'products.json');
    if (fs.existsSync(productsPath)) {
      const raw = fs.readFileSync(productsPath, 'utf-8');
      const data = JSON.parse(raw);

      // Upsert categories from file
      const fileCategories: string[] = Array.isArray(data.categories) ? data.categories : [];
      const categoryMap: Record<string, string> = {};
      for (const cname of fileCategories) {
        const c = await prisma.category.upsert({
          where: { name: cname },
          update: {},
          create: { name: cname },
        });
        categoryMap[cname] = c.id;
      }

      // Upsert brands from file
      const fileBrands: string[] = Array.isArray(data.brands) ? data.brands : [];
      const brandMap: Record<string, string> = {};
      for (const bname of fileBrands) {
        const b = await prisma.brand.upsert({
          where: { name: bname },
          update: {},
          create: { name: bname },
        });
        brandMap[bname] = b.id;
      }

      // Upsert products
      const fileProducts = Array.isArray(data.products) ? data.products : [];
      for (const p of fileProducts) {
        const catId = categoryMap[p.category] || null;
        const brandId = p.brand ? brandMap[p.brand] : null;
        if (!catId) {
          console.warn(`⚠️ Product ${p.reference} skipped: category not found - ${p.category}`);
          continue;
        }

        await prisma.product.upsert({
          where: { reference: p.reference },
          update: {
            name: p.name,
            description: p.description || null,
            categoryId: catId,
            brandId: brandId,
            unit: p.unit || 'pcs',
            buyPrice: p.buyPrice || 0,
            sellPrice: p.sellPrice || 0,
            minStock: p.minStock ?? 5,
          },
          create: {
            reference: p.reference,
            name: p.name,
            description: p.description || null,
            categoryId: catId,
            brandId: brandId,
            unit: p.unit || 'pcs',
            buyPrice: p.buyPrice || 0,
            sellPrice: p.sellPrice || 0,
            minStock: p.minStock ?? 5,
            currentStock: p.currentStock ?? 0,
          },
        });
      }

      console.log(`✅ Imported ${fileProducts.length} products from products.json`);
    }
  } catch (err) {
    console.error('Failed to load products.json:', err);
  }

  // Default settings
  const settings = [
    { key: 'company_name', value: 'Quincaillerie Générale', group: 'company' },
    { key: 'company_phone', value: '+221 77 000 00 00', group: 'company' },
    { key: 'company_address', value: 'Dakar, Sénégal', group: 'company' },
    { key: 'currency', value: 'FCFA', group: 'general' },
    { key: 'tax_rate', value: '18', group: 'general' },
    { key: 'invoice_prefix', value: 'FAC', group: 'invoice' },
    { key: 'purchase_prefix', value: 'ACH', group: 'purchase' },
    { key: 'sale_prefix', value: 'VNT', group: 'sale' },
    { key: 'low_stock_alert', value: '5', group: 'stock' },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log('✅ Default settings created');

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
