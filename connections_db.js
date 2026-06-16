const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
// Use service role key to bypass RLS policies safely on server operations
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured in environment variables.');
}

const connectionsDb = {
  async getConnection(workspaceId) {
    if (!workspaceId || !supabase) return null;
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
  },

  async saveConnection(workspaceId, connectionData) {
    if (!workspaceId || !supabase) return false;
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
      return true;
    } catch (err) {
      console.error(`Error saving connection to Supabase for workspace ${workspaceId}:`, err.message);
      return false;
    }
  },

  async updateMappings(workspaceId, mappings) {
    if (!workspaceId || !supabase) return false;
    try {
      // First, fetch current connection to merge mappings
      const connection = await this.getConnection(workspaceId);
      if (!connection) return false;

      const updatedMappings = {
        ...(connection.databaseMappings || {}),
        ...mappings
      };

      const { error } = await supabase
        .from('connections')
        .update({
          database_mappings: updatedMappings,
          updated_at: new Date().toISOString()
        })
        .eq('workspace_id', workspaceId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error(`Error updating mappings in Supabase for workspace ${workspaceId}:`, err.message);
      return false;
    }
  },

  async deleteConnection(workspaceId) {
    if (!workspaceId || !supabase) return false;
    try {
      const { error } = await supabase
        .from('connections')
        .delete()
        .eq('workspace_id', workspaceId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error(`Error deleting connection from Supabase for workspace ${workspaceId}:`, err.message);
      return false;
    }
  }
};

module.exports = connectionsDb;
