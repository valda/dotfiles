## -*- coding: utf-8-unix -*-

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

## Completion configuration
fpath=($HOME/.zsh/functions/Completion $fpath)
autoload -Uz compinit
compinit

if which dircolors > /dev/null; then
    eval `dircolors -b`
fi

zstyle ':completion:*' matcher-list 'm:{a-z}={A-Z}'
zstyle ':completion:*:default' list-colors ${(s.:.)LS_COLORS}
zstyle ':completion:*:default' menu select true
zstyle ':completion:*' use-cache true
zstyle ':completion:*' ignore-parents parent pwd ..

bindkey -e

autoload -Uz url-quote-magic
zle -N self-insert url-quote-magic

alias a=alias
a rm=" rm -i"
a sudo=" sudo"
a ls="ls -F --color --show-control-chars"
a ll="ls -l"
a la="ll -a"
a patch="patch -b --verbose"
a c="/usr/bin/clear"
a h="history -E"
a d="date"
a j="jobs"
a ec="emacsclient"
a dpkg='COLUMNS=${COLUMNS:-80} dpkg'
a psa="ps axuww"
a ssh="ssh -A"
a ag="ag --pager 'less -R'"
a chinachu='sudo -u chinachu /home/chinachu/chinachu/chinachu'
a grep="grep --color=auto"

resume-ssh-agent() {
    if [ -z "$SSH_AUTH_SOCK" -o  ! -S "$SSH_AUTH_SOCK" ]; then
        test -e "$HOME/.ssh/ssh_agent.env" && source "$HOME/.ssh/ssh_agent.env"
    else
        echo "SSH_AUTH_SOCK=$SSH_AUTH_SOCK; export SSH_AUTH_SOCK" | \
            tee "$HOME/.ssh/ssh_agent.env" | \
            awk 'BEGIN {FS="[=;]"} {printf "setenv %s %s\n", $1, $2}' > "$HOME/.ssh/ssh_agent.screenrc"
    fi
    local agent; agent=`which ssh-agent`
    if [ ! -e "$agent" ]; then
        echo missing ssh-agent
        return
    fi
    if [ -z "$SSH_AUTH_SOCK" -o ! -S "$SSH_AUTH_SOCK" ]; then
        "$agent" | grep -e '^SSH_' | tee "$HOME/.ssh/ssh_agent.env" | \
            awk 'BEGIN {FS="[=;]"} {printf "setenv %s %s\n", $1, $2}' > "$HOME/.ssh/ssh_agent.screenrc"
            source "$HOME/.ssh/ssh_agent.env"
    fi
}

history-all() {
    history -E 1
}

iscygwin() {
    [[ "$OSTYPE" = cygwin ]] && return 0
    return 1
}

isemacs() {
    [[ "$EMACS" != "" ]] && return 0
    return 1
}

istmux() {
    [[ "$TMUX" != "" ]] && return 0
    return 1
}

isscreen() {
    istmux && return 1
    [[ "${TERM[0,6]}" = screen ]] && return 0
    return 1
}

git-pull-subdirs() {
    if which parallel > /dev/null; then
        find -maxdepth 2 -type d -name '.git' | parallel 'DIR={//} ; echo ">>" $DIR; cd $DIR ; git pull --rebase'
    else
        local gitdir
        for gitdir in $(find -maxdepth 2 -type d -name '.git'); do
            (
                local dir; dir=`dirname $gitdir`
                echo '>>' $dir
                cd $dir && git pull --rebase
            )
        done
    fi
}

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
)

magic-abbrev-expand() {
    local MATCH
    LBUFFER=${LBUFFER%%(#m)[-_a-zA-Z0-9]#}
    LBUFFER+=${abbreviations[$MATCH]:-$MATCH}
    zle self-insert

}

no-magic-abbrev-expand() {
    LBUFFER+=' '

}

zle -N magic-abbrev-expand
zle -N no-magic-abbrev-expand
bindkey " " magic-abbrev-expand
bindkey "^x " no-magic-abbrev-expand

#-------------------------------------------------------------------------
# change locale
#-------------------------------------------------------------------------
utf8() {
    export LANG=ja_JP.UTF-8
    isscreen && screen -X encoding utf8
}

euc() {
    export LANG=ja_JP.EUC-JP
    isscreen && screen -X encoding euc
}

sjis() {
    export LANG=ja_JP.SJIS
    isscreen && screen -X encoding sjis
}

#-------------------------------------------------------------------------
# fancy prompt
#-------------------------------------------------------------------------
[ -f /etc/debian_chroot ] && debian_chroot=`cat /etc/debian_chroot`
PROMPT="%{[36m%}%U%B`whoami`@%m${debian_chroot:+($debian_chroot)}%b%%%{[m%}%u "
RPROMPT='%{[33m%}[%~]%{[m%}'

#-------------------------------------------------------------------------
# special functions
#-------------------------------------------------------------------------
_update_prompt () {
    if [ $? = 0 ]; then
	PROMPT="%{[36m%}%U%B`whoami`@%m${debian_chroot:+($debian_chroot)}%b%%%{[m%}%u "
    else
	PROMPT="%{[31m%}%U%B`whoami`@%m${debian_chroot:+($debian_chroot)}%b%%%{[m%}%u "
    fi
}

_update_rprompt () {
    if [ "`git ls-files 2>/dev/null`" ]; then
	local -A GIT_CURRENT_BRANCH; GIT_CURRENT_BRANCH=$( git branch &> /dev/null | grep '^\*' | cut -b 3- )
	RPROMPT="%{[33m%}[%~:$GIT_CURRENT_BRANCH]%{[m%}"
    else
	RPROMPT="%{[33m%}[%~]%{[m%}"
    fi
}

_update_term_title () {
    isemacs || echo -ne "\033]0;${USER}@${HOST}:${PWD/$HOME/~}\007"
}

precmd() {
    _update_prompt
    _update_rprompt
    _update_term_title
}

chpwd () {
    _update_rprompt
    _update_term_title
}

preexec() {
    # screen のタイトルを更新
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

#-------------------------------------------------------------------------
# zplug
#-------------------------------------------------------------------------
if [ -f ~/.zplug/init.zsh ]; then
    source ~/.zplug/init.zsh

    zplug "zsh-users/zsh-syntax-highlighting", defer:2
    zplug "zsh-users/zsh-history-substring-search"
    zplug "zsh-users/zsh-completions"
    zplug "stedolan/jq", from:gh-r, as:command, rename-to:jq
    zplug "b4b4r07/emoji-cli", on:"stedolan/jq"
    zplug "mrowa44/emojify", as:command
    zplug "junegunn/fzf-bin", from:gh-r, as:command, rename-to:fzf
    zplug "junegunn/fzf", as:command, use:"bin/fzf-tmux"
    zplug "peco/peco", as:command, from:gh-r
    #zplug "b4b4r07/peco-tmux.sh", as:command, use:'(*).sh', rename-to:'$1'
    #zplug "b4b4r07/enhancd", use:init.sh
    #export ENHANCD_DISABLE_HOME=1
    zplug "mollifier/anyframe"

    if ! zplug check --verbose; then
        printf "Install? [y/N]: "
        if read -q; then
            echo; zplug install
        fi
    fi

    zplug load
fi

#-------------------------------------------------------------------------
# cdr
#-------------------------------------------------------------------------
if [[ -n $(echo ${^fpath}/chpwd_recent_dirs(N)) && -n $(echo ${^fpath}/cdr(N)) ]]; then
    autoload -Uz chpwd_recent_dirs cdr add-zsh-hook
    add-zsh-hook chpwd chpwd_recent_dirs
    zstyle ':completion:*:*:cdr:*:*' menu selection
    zstyle ':completion:*' recent-dirs-insert both
    zstyle ':chpwd:*' recent-dirs-max 500
    zstyle ':chpwd:*' recent-dirs-default true
    zstyle ':chpwd:*' recent-dirs-pushd true
fi

#-------------------------------------------------------------------------
# anyframe
#-------------------------------------------------------------------------
if [[ -n $(echo ${^fpath}/anyframe-widget-cdr(N)) ]]; then
    #zstyle ":anyframe:selector:" use fzf
    #zstyle ":anyframe:selector:fzf:" command 'fzf-tmux --extended --cycle'
    bindkey '^[d' anyframe-widget-cdr
    bindkey '^r' anyframe-widget-put-history
    bindkey '^xb' anyframe-widget-checkout-git-branch
    bindkey '^xg' anyframe-widget-cd-ghq-repository
    bindkey '^xk' anyframe-widget-kill
    bindkey '^xi' anyframe-widget-insert-git-branch
    bindkey '^xf' anyframe-widget-insert-filename
fi

#-------------------------------------------------------------------------

resume-ssh-agent
chpwd
