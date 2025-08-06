const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
require('dotenv').config();

// Note: Using flags: 64 instead of ephemeral: true (Discord.js v14+ requirement)
// flags: 64 = MessageFlags.Ephemeral

// Environment validation with detailed logging
console.log('🔍 Environment Variable Debug:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PORT:', process.env.PORT);
console.log('- DISCORD_TOKEN exists:', !!process.env.DISCORD_TOKEN);
console.log('- DISCORD_TOKEN length:', process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.length : 0);
console.log('- DISCORD_TOKEN prefix:', process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.substring(0, 10) + '...' : 'null');
console.log('- CLIENT_ID exists:', !!process.env.CLIENT_ID);
console.log('- CLIENT_ID:', process.env.CLIENT_ID || 'null');

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    console.error('❌ Missing required environment variables:');
    console.error('- DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? 'EXISTS' : 'MISSING');
    console.error('- CLIENT_ID:', process.env.CLIENT_ID ? 'EXISTS' : 'MISSING');
    console.error('Please check your Cloud Run environment configuration.');
    process.exit(1);
}

// Validate token format
if (process.env.DISCORD_TOKEN && !process.env.DISCORD_TOKEN.match(/^[A-Za-z0-9._-]+$/)) {
    console.error('❌ DISCORD_TOKEN format appears invalid');
    console.error('Expected format: alphanumeric characters, dots, underscores, and hyphens only');
    process.exit(1);
}

// ポモドーロセッションを管理するMap
const activeSessions = new Map();

// Express app for health checks (Cloud Run requirement)
const app = express();
const PORT = process.env.PORT || 8080;

// Health check endpoint
app.get('/health', (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        discord: client.isReady() ? 'connected' : 'disconnected',
        activeSessions: activeSessions.size
    };
    res.status(200).json(health);
});

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        name: 'Discord Pomodoro Bot',
        status: 'running',
        version: '1.0.0'
    });
});

// Start HTTP server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTP server listening on port ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ]
});

// ポモドーロセッションクラス
class PomodoroSession {
    constructor(channelId, voiceChannel, textChannel, userId, settings = {}) {
        this.channelId = channelId;
        this.voiceChannel = voiceChannel;
        this.textChannel = textChannel;
        this.userId = userId;
        
        // カスタム設定またはデフォルト設定
        this.focusTime = (settings.focusTime || 25) * 60 * 1000;
        this.breakTime = (settings.breakTime || 5) * 60 * 1000;
        this.totalCycles = settings.totalCycles || 4;
        
        // 現在の状態
        this.currentCycle = 1;
        this.isBreak = false;
        this.isPaused = false;
        this.isActive = true;
        
        this.startTime = Date.now();
        this.remainingTime = this.focusTime;
        this.pausedAt = null;
        
        this.timer = null;
        this.updateInterval = null;
        
        this.messageId = null;
        
        // チャンネル固有ミュートのためのメンバー追跡
        this.mutedMembers = new Set();
    }
    
    async start() {
        await this.muteAllMembers();
        await this.sendStatusMessage();
        this.startTimer();
        this.startUpdateInterval();
    }
    
    async muteAllMembers() {
        const members = this.voiceChannel.members;
        for (const [memberId, member] of members) {
            try {
                await member.voice.setMute(true);
                this.mutedMembers.add(memberId);
            } catch (error) {
                console.error(`Failed to mute ${member.displayName}:`, error);
            }
        }
    }
    
    async unmuteAllMembers() {
        // ミュートされたメンバーのみミュート解除
        for (const memberId of this.mutedMembers) {
            try {
                const member = this.voiceChannel.guild.members.cache.get(memberId);
                if (member && member.voice.channel) {
                    await member.voice.setMute(false);
                }
            } catch (error) {
                console.error(`Failed to unmute member ${memberId}:`, error);
            }
        }
        this.mutedMembers.clear();
    }
    
    async muteMember(member) {
        try {
            await member.voice.setMute(true);
            this.mutedMembers.add(member.id);
        } catch (error) {
            console.error(`Failed to mute ${member.displayName}:`, error);
        }
    }
    
    async unmuteMember(member) {
        try {
            if (this.mutedMembers.has(member.id)) {
                await member.voice.setMute(false);
                this.mutedMembers.delete(member.id);
            }
        } catch (error) {
            console.error(`Failed to unmute ${member.displayName}:`, error);
        }
    }
    
    startTimer() {
        this.timer = setTimeout(() => {
            this.switchPhase();
        }, this.remainingTime);
    }
    
    async switchPhase() {
        if (this.isBreak) {
            // 休憩終了 → 集中開始
            this.isBreak = false;
            this.currentCycle++;
            
            if (this.currentCycle > this.totalCycles) {
                await this.complete();
                return;
            }
            
            this.remainingTime = this.focusTime;
            await this.muteAllMembers();
            const focusMinutes = Math.round(this.focusTime / 60000);
            await this.textChannel.send(`🍅 サイクル ${this.currentCycle} の集中時間が開始されました！(${focusMinutes}分)`);
        } else {
            // 集中終了 → 休憩開始
            this.isBreak = true;
            this.remainingTime = this.breakTime;
            await this.unmuteAllMembers();
            const breakMinutes = Math.round(this.breakTime / 60000);
            await this.textChannel.send(`☕ サイクル ${this.currentCycle} の休憩時間が開始されました！(${breakMinutes}分)`);
        }
        
        this.startTime = Date.now();
        await this.updateStatusMessage();
        this.startTimer();
    }
    
    async complete() {
        this.isActive = false;
        await this.unmuteAllMembers();
        
        const embed = new EmbedBuilder()
            .setTitle('🎉 ポモドーロセッション完了！')
            .setDescription('お疲れさまでした！全てのサイクルが完了しました。')
            .setColor(0x00ff00)
            .setTimestamp();
            
        await this.textChannel.send({ embeds: [embed] });
        
        this.cleanup();
        activeSessions.delete(this.channelId);
    }
    
    pause() {
        if (this.isPaused) return false;
        
        this.isPaused = true;
        this.pausedAt = Date.now();
        
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        
        return true;
    }
    
    resume() {
        if (!this.isPaused) return false;
        
        this.isPaused = false;
        const pausedDuration = Date.now() - this.pausedAt;
        this.startTime += pausedDuration;
        this.pausedAt = null;
        
        this.startTimer();
        return true;
    }
    
    async stop() {
        this.isActive = false;
        await this.unmuteAllMembers();
        this.cleanup();
        activeSessions.delete(this.channelId);
    }
    
    cleanup() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    getRemainingTime() {
        if (this.isPaused) {
            return this.remainingTime - (this.pausedAt - this.startTime);
        }
        return this.remainingTime - (Date.now() - this.startTime);
    }
    
    formatTime(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    async sendStatusMessage() {
        const embed = this.createStatusEmbed();
        const row = this.createButtonRow();
        
        const message = await this.textChannel.send({
            embeds: [embed],
            components: [row]
        });
        
        this.messageId = message.id;
    }
    
    async updateStatusMessage() {
        if (!this.messageId) return;
        
        try {
            const message = await this.textChannel.messages.fetch(this.messageId);
            const embed = this.createStatusEmbed();
            const row = this.createButtonRow();
            
            await message.edit({
                embeds: [embed],
                components: [row]
            });
        } catch (error) {
            console.error('Failed to update status message:', error);
        }
    }
    
    createStatusEmbed() {
        const remaining = this.getRemainingTime();
        const phase = this.isBreak ? '休憩時間' : '集中時間';
        const phaseEmoji = this.isBreak ? '☕' : '🍅';
        const color = this.isBreak ? 0x00ff00 : 0xff6b6b;
        
        const focusMinutes = Math.round(this.focusTime / 60000);
        const breakMinutes = Math.round(this.breakTime / 60000);
        
        const embed = new EmbedBuilder()
            .setTitle(`${phaseEmoji} ポモドーロタイマー`)
            .setDescription(`**${phase}** - サイクル ${this.currentCycle}/${this.totalCycles}`)
            .addFields(
                { name: '残り時間', value: this.formatTime(Math.max(0, remaining)), inline: true },
                { name: '状態', value: this.isPaused ? '⏸️ 一時停止中' : '▶️ 実行中', inline: true },
                { name: 'ボイスチャンネル', value: this.voiceChannel.name, inline: true },
                { name: 'タイマー設定', value: `集中: ${focusMinutes}分 / 休憩: ${breakMinutes}分`, inline: true }
            )
            .setColor(color)
            .setTimestamp();
            
        return embed;
    }
    
    createButtonRow() {
        const pauseResumeButton = new ButtonBuilder()
            .setCustomId(`pomodoro_${this.isPaused ? 'resume' : 'pause'}_${this.channelId}`)
            .setLabel(this.isPaused ? '再開' : '一時停止')
            .setEmoji(this.isPaused ? '▶️' : '⏸️')
            .setStyle(ButtonStyle.Primary);
            
        const stopButton = new ButtonBuilder()
            .setCustomId(`pomodoro_stop_${this.channelId}`)
            .setLabel('停止')
            .setEmoji('⏹️')
            .setStyle(ButtonStyle.Danger);
            
        return new ActionRowBuilder().addComponents(pauseResumeButton, stopButton);
    }
    
    startUpdateInterval() {
        this.updateInterval = setInterval(async () => {
            if (!this.isActive || this.isPaused) return;
            
            const remaining = this.getRemainingTime();
            if (remaining <= 0) return;
            
            await this.updateStatusMessage();
        }, 10000); // 10秒ごとに更新
    }
    
    async handleNewMember(member) {
        if (!this.isActive) return;
        
        try {
            if (!this.isBreak && member.voice.channel && member.voice.channel.id === this.channelId) {
                // 集中時間中に対象チャンネルに参加した場合のみミュート
                await this.muteMember(member);
            }
        } catch (error) {
            console.error(`Failed to handle new member ${member.displayName}:`, error);
        }
    }
    
    async handleMemberLeave(member) {
        if (!this.isActive) return;
        
        try {
            // 対象チャンネルから離れた場合、ミュートを解除
            if (this.mutedMembers.has(member.id)) {
                await this.unmuteMember(member);
            }
        } catch (error) {
            console.error(`Failed to handle member leave ${member.displayName}:`, error);
        }
    }
    
    async handleMemberMove(member, newChannel) {
        if (!this.isActive) return;
        
        try {
            if (newChannel && newChannel.id === this.channelId) {
                // 対象チャンネルに移動してきた場合、集中時間中ならミュート
                if (!this.isBreak) {
                    await this.muteMember(member);
                }
            } else {
                // 対象チャンネルから離れた場合、ミュートを解除
                if (this.mutedMembers.has(member.id)) {
                    await this.unmuteMember(member);
                }
            }
        } catch (error) {
            console.error(`Failed to handle member move ${member.displayName}:`, error);
        }
    }
}

// スラッシュコマンドの定義
const commands = [
    {
        name: 'pomodoro',
        description: 'ポモドーロタイマーを開始します',
        options: [
            {
                name: 'channel',
                description: 'タイマーを適用するボイスチャンネル',
                type: 7, // CHANNEL
                channel_types: [2], // GUILD_VOICE
                required: false
            },
            {
                name: 'focus_time',
                description: '集中時間（分）デフォルト: 25分',
                type: 4, // INTEGER
                required: false,
                min_value: 1,
                max_value: 120
            },
            {
                name: 'break_time',
                description: '休憩時間（分）デフォルト: 5分',
                type: 4, // INTEGER
                required: false,
                min_value: 1,
                max_value: 60
            },
            {
                name: 'cycles',
                description: 'サイクル数　デフォルト: 4回',
                type: 4, // INTEGER
                required: false,
                min_value: 1,
                max_value: 10
            }
        ]
    }
];

client.once('ready', async () => {
    console.log(`${client.user.tag} でログインしました！`);
    
    // スラッシュコマンドを登録
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    try {
        console.log('スラッシュコマンドを登録中...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log('スラッシュコマンドの登録が完了しました！');
    } catch (error) {
        console.error('スラッシュコマンドの登録に失敗しました:', error);
    }
});

// スラッシュコマンドの処理
client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'pomodoro') {
            const targetChannel = interaction.options.getChannel('channel');
            const focusTime = interaction.options.getInteger('focus_time');
            const breakTime = interaction.options.getInteger('break_time');
            const cycles = interaction.options.getInteger('cycles');
            const member = interaction.member;
            
            // ユーザーがボイスチャンネルにいるかチェック
            if (!member.voice.channel && !targetChannel) {
                return interaction.reply({
                    content: '❌ ボイスチャンネルに参加してからコマンドを実行するか、チャンネルを指定してください。',
                    flags: 64
                });
            }
            
            const voiceChannel = targetChannel || member.voice.channel;
            
            // 既にそのチャンネルでセッションが実行中かチェック
            if (activeSessions.has(voiceChannel.id)) {
                return interaction.reply({
                    content: '❌ このボイスチャンネルでは既にポモドーロセッションが実行中です。',
                    flags: 64
                });
            }
            
            // ボイスチャンネルにメンバーがいるかチェック
            if (voiceChannel.members.size === 0) {
                return interaction.reply({
                    content: '❌ 指定されたボイスチャンネルにメンバーがいません。',
                    flags: 64
                });
            }
            
            // カスタム設定を準備
            const settings = {};
            if (focusTime) settings.focusTime = focusTime;
            if (breakTime) settings.breakTime = breakTime;
            if (cycles) settings.totalCycles = cycles;
            
            // セッションを開始
            const session = new PomodoroSession(
                voiceChannel.id,
                voiceChannel,
                interaction.channel,
                interaction.user.id,
                settings
            );
            
            activeSessions.set(voiceChannel.id, session);
            
            // 設定情報を含む開始メッセージ
            const settingsText = [];
            if (focusTime) settingsText.push(`集中時間: ${focusTime}分`);
            if (breakTime) settingsText.push(`休憩時間: ${breakTime}分`);
            if (cycles) settingsText.push(`サイクル数: ${cycles}回`);
            
            const customSettings = settingsText.length > 0 ? `\n設定: ${settingsText.join(', ')}` : '';
            
            await interaction.reply({
                content: `🍅 ${voiceChannel.name} でポモドーロセッションを開始します！${customSettings}`,
                flags: 64
            });
            
            await session.start();
            }
        } else if (interaction.isButton()) {
            const [, action, channelId] = interaction.customId.split('_');
            const session = activeSessions.get(channelId);
        
            if (!session) {
                return interaction.reply({
                    content: '❌ セッションが見つかりません。',
                    flags: 64
                });
            }
            
            switch (action) {
                case 'pause':
                    if (session.pause()) {
                        await session.updateStatusMessage();
                        await interaction.reply({
                            content: '⏸️ ポモドーロタイマーを一時停止しました。',
                            flags: 64
                        });
                    } else {
                        await interaction.reply({
                            content: '❌ タイマーは既に一時停止中です。',
                            flags: 64
                        });
                    }
                    break;
                    
                case 'resume':
                    if (session.resume()) {
                        await session.updateStatusMessage();
                        await interaction.reply({
                            content: '▶️ ポモドーロタイマーを再開しました。',
                            flags: 64
                        });
                    } else {
                        await interaction.reply({
                            content: '❌ タイマーは既に実行中です。',
                            flags: 64
                        });
                    }
                    break;
                    
                case 'stop':
                    await session.stop();
                    await interaction.reply({
                        content: '⏹️ ポモドーロセッションを停止しました。',
                        flags: 64
                    });
                    break;
                    
                default:
                    await interaction.reply({
                        content: '❌ 不明なアクションです。',
                        flags: 64
                    });
                    break;
            }
        }
    } catch (error) {
        console.error('Interaction error:', error);
        
        // 既に応答済みかチェックして適切にエラーメッセージを送信
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({
                    content: '❌ エラーが発生しました。再試行してください。',
                    flags: 64
                });
            } catch (replyError) {
                console.error('Failed to send error reply:', replyError);
            }
        }
    }
});

// ボイスチャンネルの状態変化を監視
client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member;
    
    // 新しくボイスチャンネルに参加した場合
    if (!oldState.channel && newState.channel) {
        const session = activeSessions.get(newState.channel.id);
        if (session) {
            await session.handleNewMember(member);
        }
    }
    // ボイスチャンネルから完全に離脱した場合
    else if (oldState.channel && !newState.channel) {
        const session = activeSessions.get(oldState.channel.id);
        if (session) {
            await session.handleMemberLeave(member);
        }
    }
    // ボイスチャンネル間を移動した場合
    else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
        // 離脱したチャンネルのセッションをチェック
        const oldSession = activeSessions.get(oldState.channel.id);
        if (oldSession) {
            await oldSession.handleMemberLeave(member);
        }
        
        // 参加したチャンネルのセッションをチェック
        const newSession = activeSessions.get(newState.channel.id);
        if (newSession) {
            await newSession.handleMemberMove(member, newState.channel);
        }
    }
});

// エラーハンドリング
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

// Graceful shutdown for Cloud Run
process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    cleanup();
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    cleanup();
});

function cleanup() {
    console.log('Cleaning up active sessions...');
    
    // Stop all active sessions
    for (const [channelId, session] of activeSessions) {
        try {
            session.stop();
        } catch (error) {
            console.error(`Error stopping session for channel ${channelId}:`, error);
        }
    }
    
    // Disconnect from Discord
    if (client.isReady()) {
        client.destroy();
    }
    
    console.log('Cleanup completed');
    process.exit(0);
}

// Discord login with enhanced error handling
console.log('🔗 Attempting to connect to Discord...');
client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('❌ Discord login failed:', error);
    console.error('Error details:', {
        name: error.name,
        message: error.message,
        code: error.code
    });
    
    if (error.code === 'TokenInvalid') {
        console.error('🔍 Token troubleshooting tips:');
        console.error('1. Verify token is correct in Discord Developer Portal');
        console.error('2. Check token has not expired or been regenerated');
        console.error('3. Ensure no extra spaces or characters in token');
        console.error('4. Verify Cloud Run secrets are properly configured');
    }
    
    process.exit(1);
});