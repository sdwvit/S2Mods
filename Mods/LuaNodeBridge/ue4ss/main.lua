--########################
-- DEFINITIONS
--########################

local UEHelpers = require("UEHelpers")
local Pre, Post = -1, -1
local singletone = false
local function getScriptDir()
    local info = debug.getinfo(1, "S")
    if not info or not info.source then
        return nil
    end

    local source = info.source

    -- Must be a file path
    if source:sub(1, 1) ~= "@" then
        return nil
    end

    -- Strip leading '@'
    source = source:sub(2)

    -- Match both Windows '\' and Unix '/'
    return source:match("^(.*[\\/])")
end

local function log(...)
    print(..., "\n")
end

--########################
-- ENTRY POINT
--########################

local function run()
        local modDir = getScriptDir()
        if not modDir then
            log("[LuaNodeBridge] ERROR: could not resolve script directory")
            log("[LuaNodeBridge] debug.source =", debug.getinfo(1, "S").source)
            return
        end
        local nodePath = modDir .. "nodejs\\node.exe"

        local command = string.format(
            [["%s" -e "console.log(process.cwd())"]],
            nodePath
        )

        log("[LuaNodeBridge] Spawning Node.js process...")
        log("[LuaNodeBridge] Command: " .. command)

        local handle = io.popen(command, "r")
        if not handle then
            log("[LuaNodeBridge] Failed to spawn process")
            return
        end

        for line in handle:lines() do
            log("[Node] " .. line)
        end

        handle:close()

        log("[LuaNodeBridge] Node.js process exited")
end

ExecuteInGameThread(run)

--- We only need to create mod once since it is a VP singleton
Pre, Post = RegisterHook("/Script/Engine.PlayerController:ClientRestart", function(Context)
    if (not singletone) then
        run()
    else
        UnregisterHook("/Script/Engine.PlayerController:ClientRestart", Pre, Post)
    end
end)
