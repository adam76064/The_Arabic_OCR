/**
 * pages/project-dashboard/llm.js - extracted from monolith
 */

function loadLLMSettings() {
    const settings = window.__appSettings?.llmConfig || {};
    if (settings.provider) document.getElementById('llm-provider').value = settings.provider;
    if (settings.apiKey) document.getElementById('llm-api-key').value = settings.apiKey;
    if (settings.baseUrl) document.getElementById('llm-base-url').value = settings.baseUrl;
    if (settings.modelName) document.getElementById('llm-model-name').value = settings.modelName;
    
    // Trigger change to show/hide custom fields
    document.getElementById('llm-provider').dispatchEvent(new Event('change'));
}

async function saveLLMSettings(config) {
    if (!document.getElementById('llm-remember-api').checked) return;
    
    window.__appSettings = window.__appSettings || {};
    window.__appSettings.llmConfig = config;
    
    if (window.pywebview && window.pywebview.api) {
        await window.pywebview.api.save_app_settings(window.__appSettings);
    }
}

