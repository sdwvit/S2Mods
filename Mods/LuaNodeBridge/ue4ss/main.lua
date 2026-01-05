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
    if source:sub(1, 1) ~= "@" then
        return nil
    end

    source = source:sub(2)
    return source:match("^(.*[\\/])")
end

local function log(...)
    print(..., '\n')
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
    local mainjsPath = modDir .. "main.js"

    -- Check if node.exe exists
    if not io.open(nodePath, "r") then
        log("[LuaNodeBridge] ERROR: Node.js executable not found at: " .. nodePath)
        return
    end
    local command = string.format([[powershell -Command "& { & \"%s\" \"%s\" }"]], nodePath, mainjsPath)

    log("[LuaNodeBridge] Spawning Node.js process...")
    log("[LuaNodeBridge] Command: " .. command)

    -- Use io.popen to execute command and read output
    local handle = io.popen(command, "r")
    if not handle then
        log("[LuaNodeBridge] Failed to spawn process")
        return
    end

    -- Read all output
    for line in handle:lines() do
        log("[LuaNodeBridge-Node] " .. line)
    end

    -- Close and get exit code
    local exitCode = handle:close()
    if exitCode ~= 0 then
        log("[LuaNodeBridge] Node.js process exited with code: " .. tostring(exitCode))
    else
        log("[LuaNodeBridge] Node.js process exited")
    end
end

ExecuteInGameThread(run)

-- Hook to run once
Pre, Post = RegisterHook("/Script/Engine.PlayerController:ClientRestart", function(Context)
    if not singletone then
        run()
        singletone = true
    else
        UnregisterHook("/Script/Engine.PlayerController:ClientRestart", Pre, Post)
    end
end)
