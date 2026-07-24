const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// In-memory & local file fallback store
const LOCAL_STORE_FILE = path.join(__dirname, 'connections.json');
let memoryStore = {};

try {
  if (fs.existsSync(LOCAL_STORE_FILE)) {
    const raw = fs.readFileSync(LOCAL_STORE_FILE, 'utf8');
    memoryStore = JSON.parse(raw);
  }
} catch (err) {
  memoryStore = {};
}

function saveMemoryStore() {
  try {
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(memoryStore, null, 2), 'utf8');
  } catch (err) {
    // Read-only filesystem fallback (e.g. Vercel serverless environment)
  }
}

// Dynamically check Vercel KV
let kv = null;
try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { createClient: createKvClient } = require('@vercel/kv');
    kv = createKvClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN
    });
    console.log('⚡ Connected to Vercel KV connection database');
  }
} catch (err) {
  console.warn('⚠️ Vercel KV SDK not available or failed to initialize:', err.message);
}

// Dynamically check Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (!kv && supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('⚡ Connected to Supabase connection database');
  } catch (err) {
    console.warn('⚠️ Supabase failed to initialize:', err.message);
  }
}

const connectionsDb = {
  async getConnection(workspaceId) {
    if (!workspaceId) return null;

    // 1. Check local memory/file store first
    if (memoryStore[workspaceId]) {
      return memoryStore[workspaceId];
    }
    
    // 2. Try Vercel KV
    if (kv) {
      try {
        const data = await kv.get(`connection:${workspaceId}`);
        if (data) {
          memoryStore[workspaceId] = data;
          saveMemoryStore();
          return data;
        }
      } catch (err) {
        console.error(`Error fetching connection from Vercel KV for workspace ${workspaceId}:`, err.message);
      }
    }
    
    // 3. Fall back to Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('connections')
          .select('*')
          .eq('workspace_id', workspaceId)
          .maybeSingle();
        
        if (error) throw error;
        if (data) {
          const conn = {
            workspaceId: data.workspace_id,
            accessToken: data.access_token,
            workspaceName: data.workspace_name,
            databaseMappings: data.database_mappings || {},
            updatedAt: data.updated_at
          };
          memoryStore[workspaceId] = conn;
          saveMemoryStore();
          return conn;
        }
      } catch (err) {
        console.error(`Error fetching connection from Supabase for workspace ${workspaceId}:`, err.message);
      }
    }
    
    return null;
  },

  async saveConnection(workspaceId, connectionData) {
    if (!workspaceId) return false;

    const payload = {
      workspaceId,
      accessToken: connectionData.accessToken,
      workspaceName: connectionData.workspaceName,
      databaseMappings: connectionData.databaseMappings || {},
      updatedAt: new Date().toISOString()
    };

    // Always update local memory/file store
    memoryStore[workspaceId] = payload;
    saveMemoryStore();

    // 1. Save to Vercel KV
    if (kv) {
      try {
        await kv.set(`connection:${workspaceId}`, payload);
      } catch (err) {
        console.error(`Error saving connection to Vercel KV:`, err.message);
      }
    }

    // 2. Save to Supabase
    if (supabase) {
      try {
        const dbPayload = {
          workspace_id: workspaceId,
          access_token: connectionData.accessToken,
          workspace_name: connectionData.workspaceName,
          database_mappings: connectionData.databaseMappings || {},
          updated_at: payload.updatedAt
        };
        await supabase.from('connections').upsert(dbPayload, { onConflict: 'workspace_id' });
      } catch (err) {
        console.error(`Error saving connection to Supabase:`, err.message);
      }
    }

    return true;
  },

  async updateMappings(workspaceId, mappings) {
    if (!workspaceId) return false;
    
    const connection = await this.getConnection(workspaceId);
    if (!connection) return false;

    const updatedMappings = {
      ...(connection.databaseMappings || {}),
      ...mappings
    };

    connection.databaseMappings = updatedMappings;
    connection.updatedAt = new Date().toISOString();

    memoryStore[workspaceId] = connection;
    saveMemoryStore();

    if (kv) {
      try {
        await kv.set(`connection:${workspaceId}`, connection);
      } catch (err) {
        console.error(`Error updating mappings in Vercel KV:`, err.message);
      }
    }

    if (supabase) {
      try {
        await supabase
          .from('connections')
          .update({
            database_mappings: updatedMappings,
            updated_at: connection.updatedAt
          })
          .eq('workspace_id', workspaceId);
      } catch (err) {
        console.error(`Error updating mappings in Supabase:`, err.message);
      }
    }

    return true;
  },

  async deleteConnection(workspaceId) {
    if (!workspaceId) return false;
    delete memoryStore[workspaceId];
    saveMemoryStore();

    if (kv) {
      try {
        await kv.del(`connection:${workspaceId}`);
      } catch (err) {}
    }
    if (supabase) {
      try {
        await supabase.from('connections').delete().eq('workspace_id', workspaceId);
      } catch (err) {}
    }
    return true;
  }
};

module.exports = connectionsDb;
