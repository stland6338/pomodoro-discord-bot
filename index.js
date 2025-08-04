const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
require('dotenv').config();

// ポモドーロセッションを管理するMap
const activeSessions = new Map();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ]
});

// ポモドーロセッションクラス
class PomodoroSession {
    constructor(channelId, voiceChannel, textChannel, userId) {
        this.channelId = channelId;
        this.voiceChannel = voiceChannel;
        this.textChannel = textChannel;
        this.userId = userId;
        
        // デフォルト設定
        this.focusTime = 25 * 60 * 1000; // 25分
        this.breakTime = 5 * 60 * 1000;  // 5分
        this.totalCycles = 4;
        
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
            } catch (error) {
                console.error(`Failed to mute ${member.displayName}:`, error);
            }
        }
    }
    
    async unmuteAllMembers() {
        const members = this.voiceChannel.members;
        for (const [memberId, member] of members) {
            try {
                await member.voice.setMute(false);
            } catch (error) {
                console.error(`Failed to unmute ${member.displayName}:`, error);
            }
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
            await this.textChannel.send(`🍅 サイクル ${this.currentCycle} の集中時間が開始されました！(25分)`);
        } else {
            // 集中終了 → 休憩開始
            this.isBreak = true;
            this.remainingTime = this.breakTime;
            await this.unmuteAllMembers();
            await this.textChannel.send(`☕ サイクル ${this.currentCycle} の休憩時間が開始されました！(5分)`);
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
        
        const embed = new EmbedBuilder()
            .setTitle(`${phaseEmoji} ポモドーロタイマー`)
            .setDescription(`**${phase}** - サイクル ${this.currentCycle}/${this.totalCycles}`)
            .addFields(
                { name: '残り時間', value: this.formatTime(Math.max(0, remaining)), inline: true },
                { name: '状態', value: this.isPaused ? '⏸️ 一時停止中' : '▶️ 実行中', inline: true },
                { name: 'ボイスチャンネル', value: this.voiceChannel.name, inline: true }
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
            if (!this.isBreak) {
                // 集中時間中は新規参加者をミュート
                await member.voice.setMute(true);
            }
        } catch (error) {
            console.error(`Failed to handle new member ${member.displayName}:`, error);
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
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'pomodoro') {
            const targetChannel = interaction.options.getChannel('channel');
            const member = interaction.member;
            
            // ユーザーがボイスチャンネルにいるかチェック
            if (!member.voice.channel && !targetChannel) {
                return interaction.reply({
                    content: '❌ ボイスチャンネルに参加してからコマンドを実行するか、チャンネルを指定してください。',
                    ephemeral: true
                });
            }
            
            const voiceChannel = targetChannel || member.voice.channel;
            
            // 既にそのチャンネルでセッションが実行中かチェック
            if (activeSessions.has(voiceChannel.id)) {
                return interaction.reply({
                    content: '❌ このボイスチャンネルでは既にポモドーロセッションが実行中です。',
                    ephemeral: true
                });
            }
            
            // ボイスチャンネルにメンバーがいるかチェック
            if (voiceChannel.members.size === 0) {
                return interaction.reply({
                    content: '❌ 指定されたボイスチャンネルにメンバーがいません。',
                    ephemeral: true
                });
            }
            
            // セッションを開始
            const session = new PomodoroSession(
                voiceChannel.id,
                voiceChannel,
                interaction.channel,
                interaction.user.id
            );
            
            activeSessions.set(voiceChannel.id, session);
            
            await interaction.reply({
                content: `🍅 ${voiceChannel.name} でポモドーロセッションを開始します！`,
                ephemeral: true
            });
            
            await session.start();
        }
    } else if (interaction.isButton()) {
        const [, action, channelId] = interaction.customId.split('_');
        const session = activeSessions.get(channelId);
        
        if (!session) {
            return interaction.reply({
                content: '❌ セッションが見つかりません。',
                ephemeral: true
            });
        }
        
        switch (action) {
            case 'pause':
                if (session.pause()) {
                    await session.updateStatusMessage();
                    await interaction.reply({
                        content: '⏸️ ポモドーロタイマーを一時停止しました。',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '❌ タイマーは既に一時停止中です。',
                        ephemeral: true
                    });
                }
                break;
                
            case 'resume':
                if (session.resume()) {
                    await session.updateStatusMessage();
                    await interaction.reply({
                        content: '▶️ ポモドーロタイマーを再開しました。',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '❌ タイマーは既に実行中です。',
                        ephemeral: true
                    });
                }
                break;
                
            case 'stop':
                await session.stop();
                await interaction.reply({
                    content: '⏹️ ポモドーロセッションを停止しました。',
                    ephemeral: true
                });
                break;
        }
    }
});

// ボイスチャンネルの状態変化を監視
client.on('voiceStateUpdate', async (oldState, newState) => {
    // 新しくボイスチャンネルに参加した場合
    if (!oldState.channel && newState.channel) {
        const session = activeSessions.get(newState.channel.id);
        if (session) {
            await session.handleNewMember(newState.member);
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

client.login(process.env.DISCORD_TOKEN);