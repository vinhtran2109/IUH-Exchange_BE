import mongoose from 'mongoose';

const MONGODB_HOST = '127.0.0.1:27017';

const products = [
  {
    sellerId: '6659f8a84618e47087057201',
    title: 'Giáo trình Kỹ thuật phần mềm',
    description: 'Giáo trình còn mới 95%, không bị rách hay vẽ bậy. Rất phù hợp cho sinh viên khoa CNTT.',
    price: 50000,
    listingType: 'SELL',
    allowOffers: true,
    imageUrls: ['https://picsum.photos/id/1/400/300'],
    category: 'Sách & Tài liệu học tập',
    location: 'Thư viện cơ sở 1 - IUH',
    condition: 'LIKE_NEW',
    status: 'AVAILABLE',
    aiModeration: {
      status: 'PASSED',
      category: 'OK',
      reason: 'Approved',
      confidence: 0.99,
      provider: 'manual',
      model: 'manual',
      checkedAt: new Date()
    }
  },
  {
    sellerId: '6659f8a84618e47087057201',
    title: 'Bàn phím cơ cơ AKKO 3087',
    description: 'Bàn phím cơ AKKO Blue switch, gõ cực êm tai, led đơn sắc, cáp rời tiện lợi.',
    price: 450000,
    listingType: 'SELL',
    allowOffers: true,
    imageUrls: ['https://picsum.photos/id/2/400/300'],
    category: 'Thiết bị điện tử',
    location: 'Nhà H - IUH',
    condition: 'GOOD',
    status: 'AVAILABLE',
    aiModeration: {
      status: 'PASSED',
      category: 'OK',
      reason: 'Approved',
      confidence: 0.99,
      provider: 'manual',
      model: 'manual',
      checkedAt: new Date()
    }
  },
  {
    sellerId: '6659f8a84618e47087057202',
    title: 'Chuột không dây Logitech Pebble M350',
    description: 'Chuột silent cực kỳ yên tĩnh, kết nối bluetooth hoặc usb receiver. Ít dùng cần pass lại.',
    price: 180000,
    listingType: 'SELL',
    allowOffers: false,
    imageUrls: ['https://picsum.photos/id/3/400/300'],
    category: 'Thiết bị điện tử',
    location: 'Nhà D - IUH',
    condition: 'LIKE_NEW',
    status: 'AVAILABLE',
    aiModeration: {
      status: 'PASSED',
      category: 'OK',
      reason: 'Approved',
      confidence: 0.99,
      provider: 'manual',
      model: 'manual',
      checkedAt: new Date()
    }
  },
  {
    sellerId: '6659f8a84618e47087057202',
    title: 'Tặng áo thun IUH màu xanh',
    description: 'Áo thun IUH size L, còn khá mới. Mình không mặc vừa nữa nên tặng lại cho bạn nào cần.',
    price: 0,
    listingType: 'GIVE_AWAY',
    allowOffers: false,
    imageUrls: ['https://picsum.photos/id/4/400/300'],
    category: 'Thời trang & Phụ kiện',
    location: 'Nhà B - IUH',
    condition: 'GOOD',
    status: 'AVAILABLE',
    aiModeration: {
      status: 'PASSED',
      category: 'OK',
      reason: 'Approved',
      confidence: 0.99,
      provider: 'manual',
      model: 'manual',
      checkedAt: new Date()
    }
  }
];

const lostFounds = [
  {
    userId: new mongoose.Types.ObjectId('6659f8a84618e47087057201'),
    type: 'LOST',
    title: 'Thất lạc Ví da màu đen',
    description: 'Mình có đánh rơi ví da đen tại nhà H, bên trong có thẻ sinh viên tên Trần Văn Vinh và một số giấy tờ khác. Ai nhặt được liên hệ mình xin lại.',
    images: ['https://picsum.photos/id/5/400/300'],
    location: 'Nhà H - IUH',
    contactInfo: 'SĐT: 0987654321',
    category: 'ACCESSORIES',
    tags: ['ví', 'ví da', 'ví đen'],
    verificationQuestion: 'Mô tả cụ thể số tiền hoặc số thẻ sinh viên bên trong ví?',
    status: 'OPEN',
    analysisStatus: 'SKIPPED'
  },
  {
    userId: new mongoose.Types.ObjectId('6659f8a84618e47087057202'),
    type: 'FOUND',
    title: 'Nhặt được chìa khóa xe máy Yamaha',
    description: 'Nhặt được chùm chìa khóa xe máy Yamaha có móc khóa gấu bông màu đỏ tại ghế đá sân trường trước nhà A. Ai mất liên hệ nhận lại.',
    images: ['https://picsum.photos/id/6/400/300'],
    location: 'Ghế đá trước nhà A - IUH',
    contactInfo: 'Nhận lại tại phòng bảo vệ nhà A',
    category: 'KEYS',
    tags: ['chìa khóa', 'yamaha', 'móc khóa'],
    verificationQuestion: 'Móc khóa gấu bông màu gì và chùm chìa khóa có mấy cái?',
    status: 'OPEN',
    analysisStatus: 'SKIPPED'
  }
];

async function seed() {
  console.log('Starting seed script...');
  
  // Seed Products
  try {
    const productConn = await mongoose.createConnection(`mongodb://${MONGODB_HOST}/iuh_products`).asPromise();
    console.log('Connected to iuh_products database');
    
    const productSchema = new mongoose.Schema({}, { strict: false, collection: 'products' });
    const ProductModel = productConn.model('Product', productSchema);
    
    await ProductModel.deleteMany({});
    console.log('Cleared existing products');
    
    await ProductModel.insertMany(products);
    console.log(`Inserted ${products.length} mock products`);
    
    await productConn.close();
  } catch (err) {
    console.error('Error seeding products:', err);
  }

  // Seed LostFounds
  try {
    const lfConn = await mongoose.createConnection(`mongodb://${MONGODB_HOST}/iuh_lostfound`).asPromise();
    console.log('Connected to iuh_lostfound database');
    
    const lfSchema = new mongoose.Schema({}, { strict: false, collection: 'lostfounditems' });
    const LFModel = lfConn.model('LostFound', lfSchema);
    
    await LFModel.deleteMany({});
    console.log('Cleared existing lostfounditems');
    
    await LFModel.insertMany(lostFounds);
    console.log(`Inserted ${lostFounds.length} mock lost & found items`);
    
    await lfConn.close();
  } catch (err) {
    console.error('Error seeding lostfounds:', err);
  }

  console.log('Seeding completed successfully!');
  process.exit(0);
}

seed();
