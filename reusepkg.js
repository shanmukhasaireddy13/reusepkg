#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global store configuration
const GLOBAL_STORE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.reusepkg');
const STORE_PACKAGES_DIR = path.join(GLOBAL_STORE_DIR, 'store');
const REGISTRY_FILE = path.join(GLOBAL_STORE_DIR, 'registry.json');

// Initialize global store
function initializeGlobalStore() {
  if (!fs.existsSync(GLOBAL_STORE_DIR)) {
    fs.mkdirSync(GLOBAL_STORE_DIR, { recursive: true });
    console.log(chalk.green(`✅ Created global store directory: ${GLOBAL_STORE_DIR}`));
  }
  
  if (!fs.existsSync(STORE_PACKAGES_DIR)) {
    fs.mkdirSync(STORE_PACKAGES_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(REGISTRY_FILE)) {
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify({}, null, 2));
  }
}

// Load registry
function loadRegistry() {
  if (!fs.existsSync(REGISTRY_FILE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
  } catch (error) {
    console.error(chalk.red(`❌ Error reading registry: ${error.message}`));
    return {};
  }
}

// Save registry
function saveRegistry(registry) {
  try {
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
  } catch (error) {
    console.error(chalk.red(`❌ Error saving registry: ${error.message}`));
    throw error;
  }
}

// Get package key for registry
function getPackageKey(name, version) {
  return `${name}@${version}`;
}

// Normalize version for directory naming
function normalizeVersion(version) {
  return version.replace(/[^a-zA-Z0-9.-]/g, '_');
}

// Get package store path
function getPackageStorePath(name, version) {
  const normalizedVersion = normalizeVersion(version);
  return path.join(STORE_PACKAGES_DIR, name, normalizedVersion);
}

// Check if package exists in global store
function packageExistsInStore(name, version) {
  const registry = loadRegistry();
  const key = getPackageKey(name, version);
  const packageInfo = registry[key];
  
  if (!packageInfo) return false;
  
  const storePath = packageInfo.storePath;
  return fs.existsSync(storePath) && fs.existsSync(path.join(storePath, 'package.json'));
}

// This function is no longer needed since we don't store packages in global store
// We only store addresses of existing installations

// Create symlink (with fallback to copy on Windows)
function createSymlink(target, linkPath) {
  try {
    // Remove existing symlink/directory if it exists
    if (fs.existsSync(linkPath)) {
      fs.rmSync(linkPath, { recursive: true, force: true });
    }
    
    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    
    // Try to create symlink
    fs.symlinkSync(target, linkPath, 'junction');
    return true;
  } catch (error) {
    // On Windows, if symlink fails due to permissions, fallback to copy
    if (process.platform === 'win32' && error.code === 'EPERM') {
      console.log(chalk.yellow(`⚠️ Symlink failed, copying instead: ${linkPath}`));
      try {
        fs.cpSync(target, linkPath, { recursive: true });
        return false; // Indicates copy was used instead of symlink
      } catch (copyError) {
        console.error(chalk.red(`❌ Copy also failed: ${copyError.message}`));
        throw copyError;
      }
    }
    throw error;
  }
}

// Find existing package installation
function findExistingPackage(packageName, version) {
  const registry = loadRegistry();
  const key = getPackageKey(packageName, version);
  
  // Check if we already have this package in registry
  if (registry[key] && fs.existsSync(registry[key].storePath)) {
    return registry[key].storePath;
  }
  
  // Search for existing installations in common locations
  const searchPaths = [
    // Current directory and parent directories
    process.cwd(),
    path.join(process.cwd(), '..'),
    path.join(process.cwd(), '../..'),
    // Common project locations
    path.join(process.env.HOME || process.env.USERPROFILE, 'projects'),
    path.join(process.env.HOME || process.env.USERPROFILE, 'workspace'),
    path.join(process.env.HOME || process.env.USERPROFILE, 'dev'),
    // Global npm modules
    path.join(process.env.APPDATA || process.env.HOME, 'npm', 'node_modules'),
    // Node modules in common locations
    path.join(process.env.HOME || process.env.USERPROFILE, 'node_modules')
  ];
  
  for (const searchPath of searchPaths) {
    if (fs.existsSync(searchPath)) {
      const packagePath = path.join(searchPath, 'node_modules', packageName);
      if (fs.existsSync(packagePath) && fs.existsSync(path.join(packagePath, 'package.json'))) {
        // Check if version matches (approximately)
        try {
          const packageJson = JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'), 'utf8'));
          if (packageJson.version === version || version === 'latest') {
            console.log(chalk.blue(`🔍 Found existing ${packageName}@${packageJson.version} at ${packagePath}`));
            return packagePath;
          }
        } catch (error) {
          // If we can't read package.json, still use it
          console.log(chalk.blue(`🔍 Found existing ${packageName} at ${packagePath}`));
          return packagePath;
        }
      }
    }
  }
  
  return null;
}

// Install command
async function installCommand(packageName, version = 'latest') {
  if (!packageName) {
    console.error(chalk.red('❌ Please provide a package name to install'));
    console.log(chalk.yellow('Usage: reusepkg install <package-name> [version]'));
    console.log(chalk.yellow('       reusepkg i <package-name> [version]'));
    return;
  }

  // Parse package name and version if packageName contains @
  let actualPackageName = packageName;
  let actualVersion = version;
  
  if (packageName.includes('@')) {
    const parts = packageName.split('@');
    actualPackageName = parts[0];
    actualVersion = parts[1];
  }

  console.log(chalk.blue(`📦 Installing ${actualPackageName}@${actualVersion}...`));
  
  try {
    // Clean version string (remove ^, ~, etc.)
    const cleanVersion = actualVersion.replace(/^[\^~]/, '');
    
    // First, try to find existing installation
    let packagePath = findExistingPackage(actualPackageName, cleanVersion);
    
    if (!packagePath) {
      console.log(chalk.yellow(`⚠️ No existing installation found for ${actualPackageName}@${cleanVersion}`));
      console.log(chalk.blue(`📦 Installing ${actualPackageName}@${cleanVersion} with npm...`));
      
      // Install with npm in current project
      execSync(`npm install ${actualPackageName}@${cleanVersion}`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      packagePath = path.join(process.cwd(), 'node_modules', actualPackageName);
      
      // Store this installation in registry for future reuse
      const registry = loadRegistry();
      const key = getPackageKey(actualPackageName, cleanVersion);
      registry[key] = {
        name: actualPackageName,
        version: cleanVersion,
        storePath: packagePath,
        installedAt: new Date().toISOString(),
        source: 'npm-install'
      };
      saveRegistry(registry);
      
      console.log(chalk.green(`✅ Installed ${actualPackageName}@${cleanVersion} with npm`));
    } else {
      // Create symlink to existing installation
      const nodeModulesPath = path.join(process.cwd(), 'node_modules');
      if (!fs.existsSync(nodeModulesPath)) {
        fs.mkdirSync(nodeModulesPath, { recursive: true });
      }
      
      const linkPath = path.join(nodeModulesPath, actualPackageName);
      const isSymlink = createSymlink(packagePath, linkPath);
      
      if (isSymlink) {
        console.log(chalk.green(`🔗 Linked to existing ${actualPackageName}@${cleanVersion}`));
      } else {
        console.log(chalk.green(`📋 Copied from existing ${actualPackageName}@${cleanVersion}`));
      }
      
      // Store this path in registry for future reuse
      const registry = loadRegistry();
      const key = getPackageKey(actualPackageName, cleanVersion);
      registry[key] = {
        name: actualPackageName,
        version: cleanVersion,
        storePath: packagePath,
        installedAt: new Date().toISOString(),
        source: 'existing-installation'
      };
      saveRegistry(registry);
    }
    
    // Update package.json
    await updatePackageJson(actualPackageName, actualVersion);
    
    console.log(chalk.green(`✅ Successfully installed ${actualPackageName}@${cleanVersion}`));
    
  } catch (error) {
    console.error(chalk.red(`❌ Failed to install ${actualPackageName}: ${error.message}`));
  }
}

// Update package.json with new dependency
async function updatePackageJson(packageName, version) {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log(chalk.yellow('⚠️ No package.json found. Creating one...'));
    
    // Create a basic package.json
    const packageJson = {
      name: path.basename(process.cwd()),
      version: '1.0.0',
      description: '',
      main: 'index.js',
      dependencies: {}
    };
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Initialize dependencies if not exists
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }
    
    // Add the package to dependencies
    packageJson.dependencies[packageName] = version;
    
    // Write back to package.json
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    
    console.log(chalk.blue(`📝 Updated package.json with ${packageName}@${version}`));
    
  } catch (error) {
    console.log(chalk.yellow(`⚠️ Could not update package.json: ${error.message}`));
  }
}

// Find existing package in current project
function findPackageInCurrentProject(packageName, version) {
  const nodeModulesPath = path.join(process.cwd(), 'node_modules', packageName);
  
  if (fs.existsSync(nodeModulesPath) && fs.existsSync(path.join(nodeModulesPath, 'package.json'))) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(nodeModulesPath, 'package.json'), 'utf8'));
      if (packageJson.version === version || version === 'latest') {
        return nodeModulesPath;
      }
    } catch (error) {
      // If we can't read package.json, still use it
      return nodeModulesPath;
    }
  }
  
  return null;
}

// Link command
async function linkCommand() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.error(chalk.red('❌ No package.json found in current directory'));
    process.exit(1);
  }
  
  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (error) {
    console.error(chalk.red(`❌ Error reading package.json: ${error.message}`));
    process.exit(1);
  }
  
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies
  };
  
  if (!dependencies || Object.keys(dependencies).length === 0) {
    console.log(chalk.yellow('⚠️ No dependencies found in package.json'));
    return;
  }
  
  console.log(chalk.blue(`🔗 Processing ${Object.keys(dependencies).length} dependencies...`));
  
  const registry = loadRegistry();
  let updatedRegistry = false;
  
  for (const [name, version] of Object.entries(dependencies)) {
    try {
      // Clean version string (remove ^, ~, etc.)
      const cleanVersion = version.replace(/^[\^~]/, '');
      const key = getPackageKey(name, cleanVersion);
      
      // Check if package exists in global registry
      if (registry[key] && fs.existsSync(registry[key].storePath)) {
        console.log(chalk.blue(`📦 ${name}@${cleanVersion} is already available in global store`));
        console.log(chalk.gray(`   Location: ${registry[key].storePath}`));
        
        // Create symlink to existing installation
        const nodeModulesPath = path.join(process.cwd(), 'node_modules');
        if (!fs.existsSync(nodeModulesPath)) {
          fs.mkdirSync(nodeModulesPath, { recursive: true });
        }
        
        const linkPath = path.join(nodeModulesPath, name);
        const isSymlink = createSymlink(registry[key].storePath, linkPath);
        
        if (isSymlink) {
          console.log(chalk.green(`🔗 Linked to existing ${name}@${cleanVersion}`));
        } else {
          console.log(chalk.green(`📋 Copied from existing ${name}@${cleanVersion}`));
        }
      } else {
        // Check if package exists in current project
        const localPath = findPackageInCurrentProject(name, cleanVersion);
        
        if (localPath) {
          console.log(chalk.yellow(`📦 ${name}@${cleanVersion} found in current project`));
          console.log(chalk.blue(`   Adding to global registry: ${localPath}`));
          
          // Add to global registry
          registry[key] = {
            name,
            version: cleanVersion,
            storePath: localPath,
            addedAt: new Date().toISOString(),
            source: 'current-project'
          };
          updatedRegistry = true;
          
          console.log(chalk.green(`✅ Added ${name}@${cleanVersion} to global registry`));
        } else {
          console.log(chalk.red(`❌ ${name}@${cleanVersion} not found in current project`));
          console.log(chalk.yellow(`   Please install it first: npm install ${name}@${cleanVersion}`));
        }
      }
    } catch (error) {
      console.error(chalk.red(`❌ Failed to process ${name}: ${error.message}`));
    }
  }
  
  // Save registry if updated
  if (updatedRegistry) {
    saveRegistry(registry);
    console.log(chalk.blue('📝 Updated global registry'));
  }
  
  console.log(chalk.green('✅ Link command completed'));
}

// Doctor command
async function doctorCommand() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.error(chalk.red('❌ No package.json found in current directory'));
    process.exit(1);
  }
  
  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (error) {
    console.error(chalk.red(`❌ Error reading package.json: ${error.message}`));
    process.exit(1);
  }
  
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies
  };
  
  if (!dependencies || Object.keys(dependencies).length === 0) {
    console.log(chalk.yellow('⚠️ No dependencies found in package.json'));
    return;
  }
  
  console.log(chalk.blue('🔍 Checking project dependencies...'));
  
  const issues = [];
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  
  for (const [name, version] of Object.entries(dependencies)) {
    const cleanVersion = version.replace(/^[\^~]/, '');
    const linkPath = path.join(nodeModulesPath, name);
    
    if (!fs.existsSync(linkPath)) {
      issues.push({
        type: 'missing',
        name,
        version: cleanVersion,
        message: `Missing dependency: ${name}@${cleanVersion}`
      });
    } else {
      // Check if it's a broken symlink
      try {
        const stats = fs.lstatSync(linkPath);
        if (stats.isSymbolicLink()) {
          const target = fs.readlinkSync(linkPath);
          if (!fs.existsSync(target)) {
            issues.push({
              type: 'broken',
              name,
              version: cleanVersion,
              message: `Broken symlink: ${name}@${cleanVersion} -> ${target}`
            });
          }
        }
      } catch (error) {
        issues.push({
          type: 'error',
          name,
          version: cleanVersion,
          message: `Error checking ${name}: ${error.message}`
        });
      }
    }
  }
  
  if (issues.length === 0) {
    console.log(chalk.green('✅ All dependencies are properly linked'));
    return;
  }
  
  console.log(chalk.red(`❌ Found ${issues.length} issues:`));
  issues.forEach(issue => {
    console.log(chalk.red(`  • ${issue.message}`));
  });
  
  // Ask if user wants to fix issues
  const { fix } = await inquirer.prompt([{
    type: 'confirm',
    name: 'fix',
    message: 'Would you like to fix these issues by re-linking dependencies?',
    default: true
  }]);
  
  if (fix) {
    console.log(chalk.blue('🔧 Fixing issues...'));
    await linkCommand();
  }
}

// List command
function listCommand() {
  const registry = loadRegistry();
  const packages = Object.values(registry);
  
  if (packages.length === 0) {
    console.log(chalk.yellow('📦 No packages in global registry'));
    return;
  }
  
  console.log(chalk.blue(`📦 Global registry contains ${packages.length} package addresses:`));
  console.log();
  
  // Group by package name
  const grouped = packages.reduce((acc, pkg) => {
    if (!acc[pkg.name]) {
      acc[pkg.name] = [];
    }
    acc[pkg.name].push(pkg);
    return acc;
  }, {});
  
  for (const [name, versions] of Object.entries(grouped)) {
    console.log(chalk.cyan(`📦 ${name}:`));
    versions.forEach(pkg => {
      const exists = fs.existsSync(pkg.storePath);
      const status = exists ? chalk.green('✅') : chalk.red('❌');
      const source = pkg.source || 'unknown';
      console.log(`  ${status} ${pkg.version} (${pkg.storePath})`);
      console.log(chalk.gray(`     Source: ${source}`));
    });
    console.log();
  }
}

// Search command
async function searchCommand(packageName) {
  if (!packageName) {
    console.error(chalk.red('❌ Please provide a package name to search'));
    console.log(chalk.yellow('Usage: reusepkg search <package-name>'));
    return;
  }

  console.log(chalk.blue(`🔍 Searching for ${packageName}...`));
  
  try {
    // Check if package exists in global store
    const registry = loadRegistry();
    const packages = Object.values(registry);
    
    const foundPackages = packages.filter(pkg => 
      pkg.name.toLowerCase().includes(packageName.toLowerCase())
    );
    
    if (foundPackages.length > 0) {
      console.log(chalk.green(`✅ Found ${foundPackages.length} package(s) in global store:`));
      console.log();
      
      foundPackages.forEach(pkg => {
        const exists = fs.existsSync(pkg.storePath);
        const status = exists ? chalk.green('✅') : chalk.red('❌');
        console.log(`  ${status} ${pkg.name}@${pkg.version} (${pkg.storePath})`);
      });
  } else {
      console.log(chalk.yellow(`⚠️ No packages found matching "${packageName}" in global store`));
    }
    
    // Also check if package is available on npm
    console.log(chalk.blue(`\n🌐 Checking npm registry for ${packageName}...`));
    
    try {
      const result = execSync(`npm view ${packageName} --json`, { 
        encoding: 'utf8', 
        stdio: 'pipe' 
      });
      
      const packageInfo = JSON.parse(result);
      console.log(chalk.green(`✅ Package "${packageName}" is available on npm:`));
      console.log(`  📦 Name: ${packageInfo.name}`);
      console.log(`  📝 Description: ${packageInfo.description || 'No description'}`);
      console.log(`  🏷️ Latest Version: ${packageInfo.version}`);
      console.log(`  📊 Downloads: ${packageInfo.downloads ? packageInfo.downloads.lastMonth : 'Unknown'}`);
      
      if (packageInfo.keywords) {
        console.log(`  🏷️ Keywords: ${packageInfo.keywords.slice(0, 5).join(', ')}`);
      }
      
    } catch (npmError) {
      console.log(chalk.red(`❌ Package "${packageName}" not found on npm`));
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Search failed: ${error.message}`));
  }
}

// Uninstall command
async function uninstallCommand() {
  console.log(chalk.blue('🗑️ Uninstalling reusepkg...'));
  
  try {
    // Check if running as global package
    const isGlobal = process.env.npm_config_global === 'true' || 
                     process.env.npm_config_prefix || 
                     process.argv.includes('--global');
    
    if (!isGlobal) {
      console.log(chalk.yellow('⚠️ This command should be run globally. Use: npm uninstall -g reusepkg'));
      return;
    }
    
    // Ask for confirmation
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to uninstall reusepkg? This will remove the global package.',
      default: false
    }]);
    
    if (!confirm) {
      console.log(chalk.yellow('❌ Uninstall cancelled'));
      return;
    }
    
    // Ask about cleaning global store
    const { cleanStore } = await inquirer.prompt([{
      type: 'confirm',
      name: 'cleanStore',
      message: 'Do you also want to remove the global store (~/.reusepkg)? This will delete all stored packages.',
      default: false
    }]);
    
    if (cleanStore) {
      try {
        if (fs.existsSync(GLOBAL_STORE_DIR)) {
          fs.rmSync(GLOBAL_STORE_DIR, { recursive: true, force: true });
          console.log(chalk.green('✅ Global store removed'));
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠️ Could not remove global store: ${error.message}`));
        console.log(chalk.yellow('You can manually remove it later: rm -rf ~/.reusepkg'));
      }
    }
    
    console.log(chalk.green('✅ reusepkg uninstalled successfully'));
    console.log(chalk.blue('To complete the uninstall, run: npm uninstall -g reusepkg'));
    
  } catch (error) {
    console.error(chalk.red(`❌ Uninstall failed: ${error.message}`));
  }
}

// Clean command
async function cleanCommand() {
  const registry = loadRegistry();
  const packages = Object.values(registry);
  
  if (packages.length === 0) {
    console.log(chalk.yellow('📦 No packages in global registry to clean'));
    return;
  }
  
  console.log(chalk.blue('🧹 Checking for broken package addresses...'));
  
  const broken = [];
  const valid = [];
  
  for (const pkg of packages) {
    if (!fs.existsSync(pkg.storePath)) {
      broken.push(pkg);
    } else {
      valid.push(pkg);
    }
  }
  
  if (broken.length > 0) {
    console.log(chalk.red(`❌ Found ${broken.length} broken package addresses:`));
    broken.forEach(pkg => {
      console.log(chalk.red(`  • ${pkg.name}@${pkg.version} -> ${pkg.storePath}`));
    });
  }
  
  if (valid.length > 0) {
    console.log(chalk.green(`✅ Found ${valid.length} valid package addresses:`));
    valid.forEach(pkg => {
      console.log(chalk.green(`  • ${pkg.name}@${pkg.version} -> ${pkg.storePath}`));
    });
  }
  
  if (broken.length === 0) {
    console.log(chalk.green('✅ All package addresses are valid'));
    return;
  }
  
  const { clean } = await inquirer.prompt([{
    type: 'confirm',
    name: 'clean',
    message: `Remove ${broken.length} broken package addresses from global registry?`,
    default: false
  }]);
  
  if (clean) {
    console.log(chalk.blue('🧹 Cleaning broken addresses...'));
    
    const newRegistry = { ...registry };
    
    for (const pkg of broken) {
      const key = getPackageKey(pkg.name, pkg.version);
      delete newRegistry[key];
      console.log(chalk.green(`🗑️ Removed broken address for ${pkg.name}@${pkg.version}`));
    }
    
    saveRegistry(newRegistry);
    console.log(chalk.green(`✅ Cleaned ${broken.length} broken addresses`));
  }
}

// Main CLI setup
const program = new Command();

program
  .name('reusepkg')
  .description('Reuse Node.js packages across projects by linking instead of reinstalling')
  .version('1.3.0');

program
  .command('install <package-name> [version]')
  .alias('i')
  .description('Install a package and link it from global store')
  .action(async (packageName, version) => {
    try {
      initializeGlobalStore();
      await installCommand(packageName, version);
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('link')
  .description('Link project dependencies from global store')
  .action(async () => {
    try {
      initializeGlobalStore();
      await linkCommand();
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Check project dependencies for issues')
  .action(async () => {
    try {
      initializeGlobalStore();
      await doctorCommand();
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all packages in global store')
  .action(() => {
    try {
      initializeGlobalStore();
      listCommand();
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('clean')
  .description('Remove unused packages from global store')
  .action(async () => {
    try {
      initializeGlobalStore();
      await cleanCommand();
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('search <package-name>')
  .description('Search for a package in global store and npm registry')
  .action(async (packageName) => {
    try {
      initializeGlobalStore();
      await searchCommand(packageName);
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('uninstall')
  .description('Uninstall reusepkg and optionally clean global store')
  .action(async () => {
    try {
      await uninstallCommand();
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red(`❌ Unknown command: ${program.args.join(' ')}`));
  console.log(chalk.yellow('Use --help to see available commands'));
  process.exit(1);
});

// Parse command line arguments
program.parse();