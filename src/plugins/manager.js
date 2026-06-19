import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../database/init.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = path.resolve(__dirname);

/**
 * 简易插件系统
 *
 * 插件目录结构: src/plugins/<name>/index.js
 * 插件导出:
 *   export default {
 *     name, version, description,
 *     onLoad(ctx),              // 插件加载时
 *     onUnload(ctx),            // 插件卸载时（可选）
 *     handleMessage(ctx),       // 消息处理，return true 表示已处理
 *     getHelpLines(),           // 返回帮助文本行数组
 *     apis,                     // { apiName: fn } — 暴露给核心调用的API
 *   }
 *
 * 群隔离: 插件可以按群启用/禁用，存储在 plugin_rooms 表中。
 *   - '*' 行 = 全局默认
 *   - 具体 room_id 行 = 覆盖该群
 *   - 优先级: 具体群 > 全局默认 > 启用
 */
class PluginManager {
  constructor() {
    this.plugins = new Map();    // name -> plugin instance
    this.apis = new Map();       // apiName -> fn
    this.events = new Map();     // eventName -> [{pluginName, handler}]
    this._loaded = false;
  }

  /** Scan plugin dir and load all plugins */
  async loadAll() {
    if (this._loaded) return;
    this._loaded = true;

    // Ensure plugins table
    db.exec(`
      CREATE TABLE IF NOT EXISTS plugins (
        name TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        installed_at TEXT DEFAULT (datetime('now','localtime'))
      );
    `);

    // Ensure plugin_rooms table for per-room settings
    db.exec(`
      CREATE TABLE IF NOT EXISTS plugin_rooms (
        plugin_name TEXT NOT NULL,
        room_id TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (plugin_name, room_id)
      );
    `);

    const entries = fs.readdirSync(PLUGIN_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'manager.js') continue;
      if (entry.name.startsWith('.')) continue;

      const indexPath = path.join(PLUGIN_DIR, entry.name, 'index.js');
      if (!fs.existsSync(indexPath)) continue;

      try {
        const mod = await import(`./${entry.name}/index.js`);
        const plugin = mod.default;
        if (!plugin || !plugin.name) {
          console.error(`[Plugins] ${entry.name}/index.js missing default export with name`);
          continue;
        }
        this.plugins.set(plugin.name, plugin);
      } catch (err) {
        console.error(`[Plugins] Failed to load ${entry.name}:`, err.message);
      }
    }

    // Load each plugin
    for (const [, plugin] of this.plugins) {
      await this._initPlugin(plugin);
    }

    console.log(`[Plugins] Loaded ${this.plugins.size} plugin(s): ${[...this.plugins.keys()].join(', ') || '(none)'}`);
  }

  async _initPlugin(plugin) {
    // Check if enabled globally
    const row = db.prepare('SELECT enabled FROM plugins WHERE name = ?').get(plugin.name);
    if (row && !row.enabled) {
      console.log(`[Plugins] ${plugin.name} is disabled globally, skipping`);
      return;
    }

    // Register or update version
    if (!row) {
      db.prepare('INSERT INTO plugins (name, version, enabled) VALUES (?, ?, 1)').run(plugin.name, plugin.version || '1.0.0');
    } else {
      db.prepare('UPDATE plugins SET version = ? WHERE name = ?').run(plugin.version || '1.0.0', plugin.name);
    }

    // Register APIs
    if (plugin.apis) {
      for (const [apiName, fn] of Object.entries(plugin.apis)) {
        this.apis.set(apiName, fn);
      }
    }

    // Call onLoad
    try {
      if (plugin.onLoad) {
        await plugin.onLoad({
          db,
          registerAPI: (name, fn) => this.apis.set(name, fn),
          on: (event, handler) => {
            if (!this.events.has(event)) this.events.set(event, []);
            // Store handler with plugin name for per-room filtering
            this.events.get(event).push({ pluginName: plugin.name, handler });
          },
        });
      }
    } catch (err) {
      console.error(`[Plugins] ${plugin.name} onLoad failed:`, err.message);
    }
  }

  /** Check if a plugin is enabled for a specific room */
  isPluginEnabledForRoom(pluginName, roomId) {
    if (!pluginName) return true;
    // Global enabled check
    const globalRow = db.prepare('SELECT enabled FROM plugins WHERE name = ?').get(pluginName);
    if (globalRow && !globalRow.enabled) return false;
    if (!roomId) return true;
    // Room-specific check
    const roomRow = db.prepare('SELECT enabled FROM plugin_rooms WHERE plugin_name = ? AND room_id = ?').get(pluginName, roomId);
    if (roomRow) return !!roomRow.enabled;
    return true; // default: enabled
  }

  /** Route a message through all plugins. Returns true if handled. */
  handleMessage(roomId, sender, content) {
    for (const [, plugin] of this.plugins) {
      if (!this.isPluginEnabledForRoom(plugin.name, roomId)) continue;
      try {
        if (plugin.handleMessage) {
          const handled = plugin.handleMessage({ roomId, sender, content, db });
          if (handled) return true;
        }
      } catch (err) {
        console.error(`[Plugins] ${plugin.name} handleMessage error:`, err.message);
      }
    }
    return false;
  }

  /** Call a registered API */
  callAPI(apiName, ...args) {
    const fn = this.apis.get(apiName);
    if (fn) return fn(...args);
    return null;
  }

  /** Emit an event to all listeners (with per-room filtering) */
  emit(event, data) {
    const handlers = this.events.get(event);
    if (!handlers) return;
    for (const { pluginName, handler } of handlers) {
      try {
        // Per-room filter: if data has roomId, skip plugins disabled for that room
        if (data && data.roomId && !this.isPluginEnabledForRoom(pluginName, data.roomId)) continue;
        handler(data);
      } catch (err) {
        console.error(`[Plugins] Event "${event}" handler error (${pluginName}):`, err.message);
      }
    }
  }

  /** Get combined help lines from all enabled plugins */
  getPluginHelp(roomId) {
    const lines = [];
    for (const [, plugin] of this.plugins) {
      if (!this.isPluginEnabledForRoom(plugin.name, roomId || '')) continue;
      if (plugin.getHelpLines) {
        try {
          const pluginLines = plugin.getHelpLines();
          if (pluginLines && pluginLines.length > 0) {
            lines.push('', `━━ ${plugin.name} ━━`);
            lines.push(...pluginLines);
          }
        } catch { /* skip */ }
      }
    }
    return lines;
  }

  /** List all plugins with global status */
  getPluginList() {
    const list = [];
    for (const [, plugin] of this.plugins) {
      const row = db.prepare('SELECT enabled FROM plugins WHERE name = ?').get(plugin.name);
      list.push({
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        enabled: row ? !!row.enabled : true,
      });
    }
    return list;
  }

  /** Get plugin status for a specific room */
  getPluginListForRoom(roomId) {
    const list = [];
    for (const [, plugin] of this.plugins) {
      const row = db.prepare('SELECT enabled FROM plugins WHERE name = ?').get(plugin.name);
      const globallyEnabled = row ? !!row.enabled : true;
      if (!globallyEnabled) {
        list.push({ name: plugin.name, version: plugin.version, description: plugin.description, enabled: false });
        continue;
      }
      const roomRow = db.prepare('SELECT enabled FROM plugin_rooms WHERE plugin_name = ? AND room_id = ?').get(plugin.name, roomId);
      list.push({
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        enabled: roomRow ? !!roomRow.enabled : true,
      });
    }
    return list;
  }

  /** Get all rooms with plugin overrides */
  getPluginRooms() {
    const rows = db.prepare('SELECT DISTINCT room_id FROM plugin_rooms ORDER BY room_id').all();
    return rows.map(r => r.room_id).filter(id => id !== '*');
  }

  /** Uninstall a plugin — disable and remove entirely */
  uninstallPlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return { error: `Plugin "${name}" not found` };

    // Disable first
    this.togglePlugin(name, false);

    // Remove from in-memory map
    this.plugins.delete(name);

    // Remove from DB
    db.prepare('DELETE FROM plugins WHERE name = ?').run(name);
    db.prepare('DELETE FROM plugin_rooms WHERE plugin_name = ?').run(name);

    return { success: true, message: `${name} 已卸载（重启后生效）` };
  }

  /** Toggle plugin enabled/disabled globally */
  togglePlugin(name, enabled) {
    const plugin = this.plugins.get(name);
    if (!plugin) return { error: `Plugin "${name}" not found` };

    db.prepare('UPDATE plugins SET enabled = ? WHERE name = ?').run(enabled ? 1 : 0, name);

    if (enabled) {
      this._initPlugin(plugin);
    } else if (plugin.onUnload) {
      try { plugin.onUnload({ db }); } catch (err) {
        console.error(`[Plugins] ${name} onUnload error:`, err.message);
      }
      // Remove APIs
      if (plugin.apis) {
        for (const apiName of Object.keys(plugin.apis)) {
          this.apis.delete(apiName);
        }
      }
      // Clean up room overrides
      db.prepare('DELETE FROM plugin_rooms WHERE plugin_name = ?').run(name);
    }

    return { message: `${name} 已${enabled ? '启用' : '禁用'}` };
  }

  /** Toggle plugin enabled/disabled for a specific room */
  togglePluginForRoom(name, roomId, enabled) {
    const plugin = this.plugins.get(name);
    if (!plugin) return { error: `Plugin "${name}" not found` };

    // Ensure globally enabled first
    const row = db.prepare('SELECT enabled FROM plugins WHERE name = ?').get(name);
    if (!row || !row.enabled) {
      return { error: `请先在全局启用 ${name}` };
    }

    db.prepare('INSERT OR REPLACE INTO plugin_rooms (plugin_name, room_id, enabled) VALUES (?, ?, ?)').run(name, roomId, enabled ? 1 : 0);
    return { message: `「${name}」在「${roomId}」${enabled ? '已启用' : '已禁用'}` };
  }
}

export default new PluginManager();
