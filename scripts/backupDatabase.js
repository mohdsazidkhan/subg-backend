const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Backup script for MongoDB without requiring mongodump
const backupDatabase = async () => {
  try {
    console.log('💾 Starting database backup...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Database Connected to MongoDB');
    
    // Create backup directory
    const backupDir = path.join(__dirname, '../backup_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-'));
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    console.log(`📁 Backup directory created: ${backupDir}`);
    
    // Get all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📊 Found ${collections.length} collections to backup`);
    
    let totalDocuments = 0;
    
    for (const collection of collections) {
      try {
        const collectionName = collection.name;
        console.log(`🔄 Backing up collection: ${collectionName}`);
        
        // Get all documents from collection
        const documents = await mongoose.connection.db.collection(collectionName).find({}).toArray();
        
        // Create backup file
        const backupFile = path.join(backupDir, `${collectionName}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(documents, null, 2));
        
        console.log(`✅ ${collectionName}: ${documents.length} documents backed up`);
        totalDocuments += documents.length;
        
      } catch (collectionError) {
        console.error(`❌ Error backing up collection ${collection.name}:`, collectionError);
      }
    }
    
    // Create backup summary
    const summary = {
      backupDate: new Date().toISOString(),
      totalCollections: collections.length,
      totalDocuments: totalDocuments,
      collections: collections.map(c => c.name)
    };
    
    const summaryFile = path.join(backupDir, 'backup_summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    
    console.log(`\n✅ Database backup completed successfully!`);
    console.log(`📊 Summary:`);
    console.log(`   - Total collections: ${collections.length}`);
    console.log(`   - Total documents: ${totalDocuments}`);
    console.log(`   - Backup location: ${backupDir}`);
    console.log(`\n💡 To restore from backup, use the restoreDatabase.js script`);
    
  } catch (error) {
    console.error('❌ Error during backup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
};

// Run the backup
if (require.main === module) {
  backupDatabase()
    .then(() => {
      console.log('✅ Backup script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Backup script failed:', error);
      process.exit(1);
    });
}

module.exports = { backupDatabase };
