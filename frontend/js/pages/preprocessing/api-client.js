/*
 * preprocessing/api-client.js — PyWebView API Bridge Client for Pre-Processing.
 */
(function (global) {
  const PreprocessingApi = {
    async isReady() {
      if (global.AppApi && typeof global.AppApi.ready === 'function') {
        await global.AppApi.ready();
        return true;
      }
      if (global.pywebview && global.pywebview.api) return true;
      return new Promise((resolve) => {
        const handler = () => {
          window.removeEventListener('pywebviewready', handler);
          resolve(true);
        };
        window.addEventListener('pywebviewready', handler);
        setTimeout(() => resolve(Boolean(global.pywebview?.api)), 1500);
      });
    },

    async call(method, ...args) {
      await this.isReady();
      const api = global.pywebview?.api;
      if (!api || typeof api[method] !== 'function') {
        throw new Error(`API method not found: ${method}`);
      }
      return api[method](...args);
    },

    async getProject(projectId) {
      return this.call('load_project', projectId);
    },

    async getDefaults() {
      return this.call('get_preprocessing_defaults');
    },

    async previewStage(projectId, pageIndex, stageName, params = {}, fromOriginal = true) {
      return this.call('preview_preprocessing_stage', projectId, pageIndex, stageName, params, fromOriginal, 300);
    },

    async applyToPage(projectId, pageIndex, stagesParams = {}, stagesToRun = null, splitSpread = false, fromOriginal = true) {
      return this.call('apply_preprocessing_to_page', projectId, pageIndex, stagesParams, stagesToRun, splitSpread, fromOriginal, 300);
    },

    async applyStageToPage(projectId, pageIndex, stageName, stageParams = {}) {
      return this.call('apply_preprocessing_stage_to_page', projectId, pageIndex, stageName, stageParams, 300);
    },

    async applyStageToAll(projectId, stageName, stageParams = {}, pageIndices = null) {
      return this.call('apply_preprocessing_stage_to_all', projectId, stageName, stageParams, pageIndices, 300);
    },

    async batchProcess(projectId, pageIndices, stagesParams = {}, options = {}) {
      return this.call('batch_run_preprocessing', projectId, pageIndices, stagesParams, options);
    },

    async cancelBatch() {
      return this.call('cancel_preprocessing');
    },

    async resetPage(projectId, pageIndex) {
      return this.call('reset_page_preprocessing', projectId, pageIndex);
    }
  };

  global.PreprocessingApi = PreprocessingApi;
})(window);
