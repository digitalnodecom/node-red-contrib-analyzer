const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { initSchema } = require('./schema');

let db = null;

async function initDatabase(dbPath) {
    if (db) return db;
    
    try {
        // Open database with sqlite wrapper
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });
        
        // Enable foreign keys
        await db.run('PRAGMA foreign_keys = ON');
        
        // Initialize schema
        await initSchema(db);
        
        console.log('Code Analyzer database initialized successfully:', dbPath);
        return db;
    } catch (error) {
        console.error('Code Analyzer database initialization error:', error);
        throw error;
    }
}

function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase first.');
    }
    return db;
}

async function closeDatabase() {
    if (db) {
        await db.close();
        db = null;
    }
}

module.exports = {
    initDatabase,
    getDatabase,
    closeDatabase
};