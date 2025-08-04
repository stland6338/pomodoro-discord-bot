# Task Completion Workflow

## When Tasks Are Completed

Since this project has minimal tooling, the task completion workflow is simple:

### 1. Code Changes
After making any code changes to `index.js`:

```bash
# Restart the development server if running
# (nodemon should auto-restart, but manual restart may be needed)
npm run dev
```

### 2. Testing
- **No Automated Tests**: This project has no test suite
- **Manual Testing Required**: Test functionality by:
  - Running the bot in a Discord server
  - Using `/pomodoro` command in voice channels
  - Testing pause/resume/stop functionality
  - Verifying mute/unmute behavior

### 3. No Linting or Formatting
- **No ESLint**: No linting commands to run
- **No Prettier**: No code formatting to apply
- **No Type Checking**: Pure JavaScript, no TypeScript checking

### 4. Environment Considerations
- Ensure `.env` file is properly configured
- Verify Discord bot has necessary permissions
- Check that bot is invited to test server

### 5. Deployment Considerations
- For production: Use `npm start` instead of `npm run dev`
- Ensure production environment has proper `.env` configuration
- Monitor console output for errors

## Recommended Manual Testing Checklist
After code changes, manually verify:
- [ ] Bot connects to Discord successfully
- [ ] Slash commands register properly
- [ ] `/pomodoro` command works in voice channels
- [ ] Timer phases transition correctly (focus → break → focus)
- [ ] Mute/unmute functionality works
- [ ] Pause/resume buttons function
- [ ] Stop button terminates sessions
- [ ] Multiple voice channels can run concurrent sessions
- [ ] New members joining during focus time get muted
- [ ] Session completion triggers proper cleanup

## Error Monitoring
Monitor console output for:
- Discord API errors
- Permission errors (muting/unmuting)
- Unhandled promise rejections
- Uncaught exceptions