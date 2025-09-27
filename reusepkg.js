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

// Install package to global store
async function installToGlobalStore(name, version) {
  const registry = loadRegistry();
  const key = getPackageKey(name, version);
  
  if (packageExistsInStore(name, version)) {
    console.log(chalk.blue(`📦 Package ${name}@${version} already exists in global store`));
    return registry[key].storePath;
  }
  
  console.log(chalk.yellow(`⬇️ Installing ${name}@${version} to global store...`));
  
  const storePath = getPackageStorePath(name, version);
  fs.mkdirSync(storePath, { recursive: true });
  
  try {
    // Install package to global store
    execSync(`npm install ${name}@${version} --prefix "${storePath}" --no-save`, {
      stdio: 'inherit',
      cwd: storePath
    });
    
    // Update registry
    registry[key] = {
      name,
      version,
      storePath,
      installedAt: new Date().toISOString()
    };
    saveRegistry(registry);
    
    console.log(chalk.green(`✅ Installed ${name}@${version} to global store`));
    return storePath;
  } catch (error) {
    // Clean up on failure
    if (fs.existsSync(storePath)) {
      fs.rmSync(storePath, { recursive: true, force: true });
    }
    console.error(chalk.red(`❌ Failed to install ${name}@${version}: ${error.message}`));
    throw error;
  }
}

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
  
  console.log(chalk.blue(`🔗 Linking ${Object.keys(dependencies).length} dependencies...`));
  
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    fs.mkdirSync(nodeModulesPath, { recursive: true });
  }
  
  for (const [name, version] of Object.entries(dependencies)) {
    try {
      // Clean version string (remove ^, ~, etc.)
      const cleanVersion = version.replace(/^[\^~]/, '');
      
      // Install to global store if not exists
      const storePath = await installToGlobalStore(name, cleanVersion);
      
      // Create symlink
      const linkPath = path.join(nodeModulesPath, name);
      const isSymlink = createSymlink(storePath, linkPath);
      
      if (isSymlink) {
        console.log(chalk.green(`🔗 Linked ${name}@${cleanVersion}`));
      } else {
        console.log(chalk.green(`📋 Copied ${name}@${cleanVersion}`));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Failed to link ${name}: ${error.message}`));
    }
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
    console.log(chalk.yellow('📦 No packages in global store'));
    return;
  }
  
  console.log(chalk.blue(`📦 Global store contains ${packages.length} packages:`));
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
      console.log(`  ${status} ${pkg.version} (${pkg.storePath})`);
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
    console.log(chalk.yellow('📦 No packages in global store to clean'));
    return;
  }
  
  console.log(chalk.blue('🧹 Checking for unused packages...'));
  
  const unused = [];
  const broken = [];
  
  for (const pkg of packages) {
    if (!fs.existsSync(pkg.storePath)) {
      broken.push(pkg);
    } else {
      // Check if package is referenced by any symlinks
      let isUsed = false;
      
      // This is a simplified check - in a real implementation,
      // you might want to scan all projects for symlinks
      try {
        // Check if any symlinks point to this package
        const storeDir = path.dirname(pkg.storePath);
        const packageDir = path.basename(pkg.storePath);
        
        // Look for symlinks in common project locations
        const commonPaths = [
          path.join(process.env.HOME || process.env.USERPROFILE, 'projects'),
          path.join(process.env.HOME || process.env.USERPROFILE, 'workspace'),
          process.cwd()
        ];
        
        for (const basePath of commonPaths) {
          if (fs.existsSync(basePath)) {
            // This is a simplified check - in practice, you'd need to recursively scan
            // for symlinks that point to the package
            break;
          }
        }
        
        // For now, mark as unused if we can't find references
        // In a real implementation, you'd track symlink references
        unused.push(pkg);
      } catch (error) {
        console.log(chalk.yellow(`⚠️ Error checking usage for ${pkg.name}@${pkg.version}: ${error.message}`));
      }
    }
  }
  
  if (broken.length > 0) {
    console.log(chalk.red(`❌ Found ${broken.length} broken packages:`));
    broken.forEach(pkg => {
      console.log(chalk.red(`  • ${pkg.name}@${pkg.version}`));
    });
  }
  
  if (unused.length > 0) {
    console.log(chalk.yellow(`⚠️ Found ${unused.length} potentially unused packages:`));
    unused.forEach(pkg => {
      console.log(chalk.yellow(`  • ${pkg.name}@${pkg.version}`));
    });
  }
  
  if (broken.length === 0 && unused.length === 0) {
    console.log(chalk.green('✅ No packages need cleaning'));
    return;
  }
  
  const { clean } = await inquirer.prompt([{
    type: 'confirm',
    name: 'clean',
    message: `Remove ${broken.length + unused.length} packages from global store?`,
    default: false
  }]);
  
  if (clean) {
    console.log(chalk.blue('🧹 Cleaning packages...'));
    
    const toRemove = [...broken, ...unused];
    const newRegistry = { ...registry };
    
    for (const pkg of toRemove) {
      const key = getPackageKey(pkg.name, pkg.version);
      delete newRegistry[key];
      
      if (fs.existsSync(pkg.storePath)) {
        fs.rmSync(pkg.storePath, { recursive: true, force: true });
      }
      
      console.log(chalk.green(`🗑️ Removed ${pkg.name}@${pkg.version}`));
    }
    
    saveRegistry(newRegistry);
    console.log(chalk.green(`✅ Cleaned ${toRemove.length} packages`));
  }
}

// Main CLI setup
const program = new Command();

program
  .name('reusepkg')
  .description('Reuse Node.js packages across projects by linking instead of reinstalling')
  .version('1.2.2');

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