## -*- mode: sh; coding: utf-8-unix -*-

###
# Set shell options
###
setopt auto_list
setopt auto_menu
setopt auto_cd
setopt auto_name_dirs
setopt auto_remove_slash
setopt correct
setopt prompt_subst
setopt print_eight_bit
setopt auto_pushd
setopt pushd_ignore_dups
setopt rm_star_silent
setopt sun_keyboard_hack
setopt extended_glob
setopt list_types
setopt no_beep
setopt no_flowcontrol
setopt always_last_prompt
setopt cdable_vars
setopt sh_word_split
setopt auto_param_keys
setopt extended_history
setopt append_history
setopt magic_equal_subst
setopt hist_ignore_space
setopt hist_expire_dups_first
setopt hist_ignore_all_dups
setopt hist_reduce_blanks
setopt share_history
setopt interactivecomments

HISTFILE="$HOME/.zsh-history"
HISTSIZE=10000
SAVEHIST=10000
WORDCHARS="`echo $WORDCHARS|sed 's!/!!'`"
if which dircolors > /dev/null; then
    eval `dircolors -b`
fi

bindkey -e
bindkey "^[[1;5C" emacs-forward-word
bindkey "^[[1;5D" emacs-backward-word

autoload -Uz url-quote-magic
zle -N self-insert url-quote-magic

alias rm=" rm -I"
alias sudo=" sudo"
alias ls="ls -F --color --show-control-chars --group-directories-first"
alias ll="ls -l"
alias la="ll -a"
alias patch="patch -b --verbose"
alias c="/usr/bin/clear"
alias h="history -E"
alias d="date"
alias j="jobs"
alias ec='emacsclient -r --no-wait'
alias dpkg='COLUMNS=${COLUMNS:-80} dpkg'
alias psa="ps axuww"
alias ssh="ssh -A"
alias ag="ag --pager 'less -R'"
alias grep="grep --color=auto"
alias open='xdg-open'
alias gcauto='git commit -m "$(claude -p "Look at the staged git changes and create a summarizing git commit title. Only respond with the title and no affirmation.")"'

function history-all() {
    history -E 1
}

function iscygwin() {
    [[ "$OSTYPE" = cygwin ]] && return 0
    return 1
}

function isemacs() {
    [[ "$INSIDE_EMACS" != "" ]] && return 0
    return 1
}

function istmux() {
    [[ "$TMUX" != "" ]] && return 0
    return 1
}

function isscreen() {
    istmux && return 1
    [[ "${TERM[0,6]}" = screen ]] && return 0
    return 1
}

function isdumb() {
    [[ "${TERM[0,4]}" = dumb ]] && return 0
    return 1
}

#-------------------------------------------------------------------------
# Zinit
#-------------------------------------------------------------------------
if [[ ! -f $HOME/.zinit/bin/zinit.zsh ]]; then
    print -P "%F{33}▓▒░ %F{220}Installing DHARMA Initiative Plugin Manager (zdharma/zinit)…%f"
    command mkdir -p "$HOME/.zinit" && command chmod g-rwX "$HOME/.zinit"
    if ! command git clone https://github.com/zdharma-continuum/zinit "$HOME/.zinit/bin" 2> /tmp/zinit_install_err.log; then
        print -P "%F{160}▓▒░ The clone has failed. Check /tmp/zinit_install_err.log for details.%f"
        cat /tmp/zinit_install_err.log
        return 1
    fi
    print -P "%F{33}▓▒░ %F{34}Installation successful.%f"
fi

source "$HOME/.zinit/bin/zinit.zsh"
autoload -Uz _zinit
(( ${+_comps} )) && _comps[zinit]=_zinit


# プラグインとスニペットのロード
# 補完系は早めにロード
zinit ice wait"0" lucid
zinit light zsh-users/zsh-completions

# Oh My Zshのスニペット（gitとか）
zinit ice wait"0" lucid
zinit snippet OMZL::git.zsh

# fzf関連（packでシンプルに）
zinit pack for fzf
zinit ice wait"0" lucid
zinit light mollifier/anyframe
fpath=($HOME/.zsh/anyframe-custom $fpath)

zinit ice depth=1
zinit light romkatv/powerlevel10k

zinit ice as"program" pick"$ZPFX/bin/pfetch" make"PREFIX=$ZPFX" wait"2" lucid
zinit light dylanaraps/pfetch
zinit ice as"program" has"tmux" pick"bin/xpanes" wait"1" lucid
zinit light "greymd/tmux-xpanes"

# Docker Compose関連（V2前提で補完のみ入れる）
# zinit pack for docker-compose がエラー出るので、補完だけOh My Zshスニペットで対応
zinit ice wait"0" lucid as"completion"
zinit snippet https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/plugins/docker-compose/_docker-compose

# シンタックスハイライトは最後にロード
typeset -A FAST_HIGHLIGHT_STYLES
FAST_HIGHLIGHT_STYLES[path-to-dir]='fg=magenta,bold' # path-to-dirのunderlineうざすぎ
zinit ice wait"1" lucid atload"zinit cdreplay -q"
zinit light zdharma-continuum/fast-syntax-highlighting

#-------------------------------------------------------------------------
# Completion configuration
#-------------------------------------------------------------------------
fpath=($HOME/.zsh/completions(N-/) $fpath)
autoload -Uz compinit && compinit

zstyle ':completion:*' verbose yes
zstyle ':completion:*' completer _expand _complete _match _prefix _approximate _list _history
zstyle ':completion:*:messages' format '%F{yellow}%d%f'
zstyle ':completion:*:warnings' format '%F{red}%BNo matches for:%b %F{yellow}%d%f'
zstyle ':completion:*:descriptions' format '%F{yellow}%B[%d]%b%f'
zstyle ':completion:*:corrections' format '%F{yellow}%B[%d] %F{red}(errors: %e)%b%f'
zstyle ':completion:*:options' description 'yes'
zstyle ':completion:*' group-name ''
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Z}'
zstyle ':completion:*:default' list-colors ${(s.:.)LS_COLORS}
zstyle ':completion:*:default' menu select true
zstyle ':completion:*' use-cache true
zstyle ':completion:*' ignore-parents parent pwd ..
zstyle ':completion:*:manuals' separate-sections true

#-------------------------------------------------------------------------
# cdr
#-------------------------------------------------------------------------
autoload -Uz chpwd_recent_dirs cdr add-zsh-hook
add-zsh-hook chpwd chpwd_recent_dirs
zstyle ':completion:*:*:cdr:*:*' menu selection
zstyle ':completion:*' recent-dirs-insert both
zstyle ':chpwd:*' recent-dirs-max 500
zstyle ':chpwd:*' recent-dirs-default true
zstyle ':chpwd:*' recent-dirs-pushd true

#-------------------------------------------------------------------------
# anyframe
#-------------------------------------------------------------------------
zstyle ":anyframe:selector:" use fzf
if istmux; then
    zstyle ":anyframe:selector:fzf:" command 'fzf-tmux --extended --exact --no-sort --cycle'
fi

bindkey '^[d' anyframe-widget-cdr
bindkey '^r' anyframe-widget-put-history
bindkey '^xb' anyframe-widget-checkout-git-branch
bindkey '^xg' anyframe-widget-cd-ghq-repository
bindkey '^xk' anyframe-widget-kill
bindkey '^xi' anyframe-widget-insert-git-branch
bindkey '^xf' anyframe-widget-insert-filename
bindkey '^xc' anyframe-widget-insert-docker-container-id

#-------------------------------------------------------------------------
# zmv
#-------------------------------------------------------------------------
autoload -Uz zmv
alias zmv='noglob zmv -W'

#-------------------------------------------------------------------------
# abbrev
#-------------------------------------------------------------------------
typeset -A abbreviations
abbreviations=(
    "L"    "| less"
    "G"    "| grep"
    "X"    "| xargs"
    "T"    "| tail"
    "C"    "| cat"
    "W"    "| wc"
    "A"    "| awk"
    "S"    "| sed"
    "E"    "2>&1 > /dev/null"
    "N"    "> /dev/null"
    "P"    "| peco"
    'be'   'bundle exec'
    'de'   'docker exec -it'
)

function magic-abbrev-expand() {
    local MATCH
    LBUFFER=${LBUFFER%%(#m)[-_a-zA-Z0-9]#}
    LBUFFER+=${abbreviations[$MATCH]:-$MATCH}
    zle self-insert
}

function no-magic-abbrev-expand() {
    LBUFFER+=' '
}

zle -N magic-abbrev-expand
zle -N no-magic-abbrev-expand
bindkey " " magic-abbrev-expand
bindkey "^x " no-magic-abbrev-expand

#-------------------------------------------------------------------------
# Window Title と Term Title の更新
#-------------------------------------------------------------------------
function _precmd_update_term_title () {
    isemacs || echo -ne "\033]0;${USER}@${HOST}:${PWD/$HOME/~}\007"
}

function _preexec_update_window_title () {
    # screen/tmux のタイトルを更新
    if isemacs; then return; fi
    if isscreen || istmux; then
        emulate -L zsh
        local -a cmd; cmd=(${(z)2})
        case $cmd[1] in
            fg)
                if (( $#cmd == 1 )); then
                    cmd=(builtin jobs -l %+)
                else
                    cmd=(builtin jobs -l $cmd[2])
                fi
                ;;
            %*)
                cmd=(builtin jobs -l $cmd[1])
                ;;
            cd)
                if (( $#cmd == 2 )); then
                    cmd[1]=$cmd[2]
                fi
                ;&
            *)
                echo -ne "\033k$cmd[1]:t\033\\"
                return
                ;;
        esac
        local -A jt; jt=(${(kv)jobtexts})
        $cmd >>(read num rest
            cmd=(${(z)${(e):-\$jt$num}})
            echo -ne "\033k$cmd[1]:t\033\\") 2>/dev/null
    fi
}

add-zsh-hook precmd _precmd_update_term_title
add-zsh-hook preexec _preexec_update_window_title

#-------------------------------------------------------------------------
function utf8() {
    export LANG=ja_JP.UTF-8
    isscreen && screen -X encoding utf8
}

function euc() {
    export LANG=ja_JP.EUC-JP
    isscreen && screen -X encoding euc
}

function sjis() {
    export LANG=ja_JP.SJIS
    isscreen && screen -X encoding sjis
}

function git-pull-subdirs() {
    if which parallel > /dev/null; then
        find -maxdepth 2 -type d -name '.git' | parallel 'DIR={//} ; echo ">>" $DIR; cd $DIR ; git pull --rebase'
    else
        local gitdir
        for gitdir in $(find -maxdepth 2 -type d -name '.git'); do
            (
                local dir=$(dirname $gitdir)
                echo '>>' $dir
                cd $dir && git pull --rebase
            )
        done
    fi
}

function resume-ssh-agent() {
    local agent
    agent=`which wsl2-ssh-agent`
    if [ -e "${agent}" ]; then
       eval `$agent`
       return
    fi

    if [ -z "$SSH_AUTH_SOCK" -o  ! -S "$SSH_AUTH_SOCK" ]; then
        test -e "$HOME/.ssh/ssh_agent.env" && source "$HOME/.ssh/ssh_agent.env"
    else
        echo "SSH_AUTH_SOCK=$SSH_AUTH_SOCK; export SSH_AUTH_SOCK" | \
            tee "$HOME/.ssh/ssh_agent.env" | \
            awk 'BEGIN {FS="[=;]"} {printf "setenv %s %s\n", $1, $2}' > "$HOME/.ssh/ssh_agent.screenrc"
    fi

    agent=`which ssh-agent`
    if [ ! -e "${agent}" ]; then
        echo missing ssh-agent
    elif [ -z "$SSH_AUTH_SOCK" -o ! -S "$SSH_AUTH_SOCK" ]; then
        $agent | grep -e '^SSH_' | tee "$HOME/.ssh/ssh_agent.env" | \
            awk 'BEGIN {FS="[=;]"} {printf "setenv %s %s\n", $1, $2}' > "$HOME/.ssh/ssh_agent.screenrc"
        source "$HOME/.ssh/ssh_agent.env"
    fi
}

resume-ssh-agent

#-------------------------------------------------------------------------
if isdumb; then
    unsetopt zle
    unsetopt prompt_cr
    unsetopt prompt_subst
    unfunction precmd
    unfunction preexec
    PS1='$ '
fi

if isemacs; then
    unsetopt prompt_cr
    PROMPT=$RPROMPT$'\n'$PROMPT
    unset RPROMPT

    if [[ "$INSIDE_EMACS" = 'vterm' ]] \
           && [[ -n ${EMACS_VTERM_PATH} ]] \
           && [[ -f ${EMACS_VTERM_PATH}/etc/emacs-vterm-zsh.sh ]]; then
        source ${EMACS_VTERM_PATH}/etc/emacs-vterm-zsh.sh
    fi
fi

# Start tmux
if ! isemacs && ! istmux && ! isscreen && ! isdumb && which tmux > /dev/null; then
    ID=$(tmux list-sessions 2>/dev/null | awk -F: '!/attached/ { print $1; exit }')
    if [[ -z "$ID" ]]; then
        tmux new-session
    else
        tmux attach-session -t $ID
    fi
fi

# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
ZLE_RPROMPT_INDENT=0
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh
