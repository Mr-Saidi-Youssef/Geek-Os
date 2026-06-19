const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// We will dynamically import/require @vercel/kv if it exists and check if it is configured
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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (!kv) {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  } else {
    console.warn('⚠️ Note: Neither Vercel KV nor Supabase is configured.');
  }
}

const connectionsDb = {
  async getConnection(workspaceId) {
    if (!workspaceId) return null;
    
    // 1. Try Vercel KV
    if (kv) {
      try {
        const data = await kv.get(`connection:${workspaceId}`);
        if (data) {
          return {
            workspaceId: data.workspaceId,
            accessToken: data.accessToken,
            workspaceName: data.workspaceName,
            databaseMappings: data.databaseMappings || {},
            updatedAt: data.updatedAt
          };
        }
      } catch (err) {
        console.error(`Error fetching connection from Vercel KV for workspace ${workspaceId}:`, err.message);
      }
    }
    
    // 2. Fall back to Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('connections')
          .select('*')
          .eq('workspace_id', workspaceId)
          .maybeSingle();
        
        if (error) throw error;
        if (!data) return null;
        
        return {
          workspaceId: data.workspace_id,
          accessToken: data.access_token,
          workspaceName: data.workspace_name,
          databaseMappings: data.database_mappings || {},
          updatedAt: data.updated_at
        };
      } catch (err) {
        console.error(`Error fetching connection from Supabase for workspace ${workspaceId}:`, err.message);
        return null;
      }
    }
    
    return null;
  },

  async saveConnection(workspaceId, connectionData) {
    if (!workspaceId) return false;
    let saved = false;

    // 1. Save to Vercel KV
    if (kv) {
      try {
        const payload = {
          workspaceId,
          accessToken: connectionData.accessToken,
          workspaceName: connectionData.workspaceName,
          databaseMappings: connectionData.databaseMappings || {},
          updatedAt: new Date().toISOString()
        };
        await kv.set(`connection:${workspaceId}`, payload);
        saved = true;
      } catch (err) {
        console.error(`Error saving connection to Vercel KV for workspace ${workspaceId}:`, err.message);
      }
    }

    // 2. Save to Supabase (either as fallback or dual-write if wanted, let's keep it as fallback/alternative)
    if (!saved && supabase) {
      try {
        const payload = {
          workspace_id: workspaceId,
          access_token: connectionData.accessToken,
          workspace_name: connectionData.workspaceName,
          database_mappings: connectionData.databaseMappings || {},
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('connections')
          .upsert(payload, { onConflict: 'workspace_id' });

        if (error) throw error;
        saved = true;
      } catch (err) {
        console.error(`Error saving connection to Supabase for workspace ${workspaceId}:`, err.message);
      }
    }

    return saved;
  },

  async updateMappings(workspaceId, mappings) {
    if (!workspaceId) return false;
    
    // Fetch current connection first
    const connection = await this.getConnection(workspaceId);
    if (!connection) return false;

    const updatedMappings = {
      ...(connection.databaseMappings || {}),
      ...mappings
    };

    let updated = false;

    // 1. Update in Vercel KV
    if (kv) {
      try {
        const payload = {
          ...connection,
          databaseMappings: updatedMappings,
          updatedAt: new Date().toISOString()
        };
        await kv.set(`connection:${workspaceId}`, payload);
        updated = true;
      } catch (err) {
        console.error(`Error updating mappings in Vercel KV for workspace ${workspaceId}:`, err.message);
      }
    }

    // 2. Update in Supabase
    if (!updated && supabase) {
      try {
        const { error } = await supabase
          .from('connections')
          .update({
            database_mappings: updatedMappings,
            updated_at: new Date().toISOString()
          })
          .eq('workspace_id', workspaceId);

        if (error) throw error;
        updated = true;
      } catch (err) {
        console.error(`Error updating mappings in Supabase for workspace ${workspaceId}:`, err.message);
      }
    }

    return updated;
  },

  async deleteConnection(workspaceId) {
    if (!workspaceId) return false;
    let deleted = false;

    // 1. Delete from Vercel KV
    if (kv) {
      try {
        await kv.del(`connection:${workspaceId}`);
        deleted = true;
      } catch (err) {
        console.error(`Error deleting connection from Vercel KV for workspace ${workspaceId}:`, err.message);
      }
    }

    // 2. Delete from Supabase
    if (supabase) {
      try {
        const { error } = await supabase
          .from('connections')
          .delete()
          .eq('workspace_id', workspaceId);

        if (error) throw error;
        deleted = true;
      } catch (err) {
        console.error(`Error deleting connection from Supabase for workspace ${workspaceId}:`, err.message);
      }
    }

    return deleted;
  }
};

module.exports = connectionsDb;
