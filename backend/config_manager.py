import os
import json
import shutil
from pathlib import Path

class ConfigManager:
    def __init__(self):
        self.app_data_dir = self._get_default_appdata_dir()
        os.makedirs(self.app_data_dir, exist_ok=True)
        self.meta_config_path = os.path.join(self.app_data_dir, 'meta_config.json')

    def _get_default_appdata_dir(self):
        """Returns the default AppData folder for the application."""
        appdata = os.getenv('APPDATA')
        if not appdata:
            appdata = os.path.join(str(Path.home()), 'AppData', 'Roaming')
        return os.path.join(appdata, 'The_Arabic_OCR')

    def get_data_path(self):
        """Returns the user-selected data path, or defaults to the AppData folder."""
        if os.path.exists(self.meta_config_path):
            try:
                with open(self.meta_config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    path = config.get('data_path')
                    if path and os.path.isdir(path):
                        return path
            except Exception as e:
                print(f"Error reading meta_config.json: {e}")
        
        # Default fallback
        return self.app_data_dir

    def change_data_path(self, new_path):
        """Updates the data path in the meta_config and moves existing data."""
        old_path = self.get_data_path()
        new_path = os.path.abspath(new_path)
        
        if old_path == new_path:
            return True, "Path is already the current data path."

        if not os.path.exists(new_path):
            os.makedirs(new_path, exist_ok=True)

        # Move projects directory if it exists
        old_projects = os.path.join(old_path, 'projects')
        new_projects = os.path.join(new_path, 'projects')

        if os.path.exists(old_projects):
            if os.path.exists(new_projects) and os.listdir(new_projects):
                try:
                    for item in os.listdir(old_projects):
                        s = os.path.join(old_projects, item)
                        d = os.path.join(new_projects, item)
                        if os.path.exists(d):
                            if os.path.isdir(s): shutil.rmtree(d)
                            else: os.remove(d)
                        shutil.move(s, d)
                    shutil.rmtree(old_projects)
                except Exception as e:
                    return False, f"Failed to move projects: {e}"
            else:
                try:
                    shutil.move(old_projects, new_projects)
                except Exception as e:
                    return False, f"Failed to move projects folder: {e}"

        # Update meta config
        try:
            with open(self.meta_config_path, 'w', encoding='utf-8') as f:
                json.dump({'data_path': new_path}, f, ensure_ascii=False, indent=4)
        except Exception as e:
            return False, f"Failed to save meta_config: {e}"

        return True, "Success"

    def auto_migrate_legacy_data(self):
        """Migrates data from the old local 'projects' folder to the new AppData default on first run."""
        # Check if meta_config exists. If it does, we already migrated or user already configured.
        if os.path.exists(self.meta_config_path):
            return

        # Check if local 'projects' exists and has content
        local_projects = os.path.abspath('projects')
        if os.path.exists(local_projects) and os.listdir(local_projects):
            default_path = self.get_data_path() # APPDATA
            new_projects = os.path.join(default_path, 'projects')
            
            try:
                os.makedirs(default_path, exist_ok=True)
                if not os.path.exists(new_projects):
                    shutil.move(local_projects, new_projects)
                else:
                    # If target somehow exists, move contents
                    for item in os.listdir(local_projects):
                        s = os.path.join(local_projects, item)
                        d = os.path.join(new_projects, item)
                        if not os.path.exists(d):
                            shutil.move(s, d)
                
            except Exception as e:
                print(f"Auto-migration failed: {e}")
                return

        # Create meta config to signal migration is complete
        try:
            with open(self.meta_config_path, 'w', encoding='utf-8') as f:
                json.dump({'data_path': self.app_data_dir}, f, ensure_ascii=False, indent=4)
        except:
            pass
