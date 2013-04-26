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
setopt always_last_prompt
setopt cdable_vars
setopt sh_word_split
setopt auto_param_keys
setopt extended_history
setopt append_history
setopt hist_ignore_space
setopt magic_equal_subst

HISTFILE="$HOME/.zsh-history"
HISTSIZE=10000
SAVEHIST=10000
WORDCHARS="`echo $WORDCHARS|sed 's!/!!'`"

case $ZSH_VERSION in
4.*)
setopt hist_expire_dups_first
setopt hist_ignore_all_dups
setopt share_history

## Completion configuration
#
fpath=(~/.zsh/functions/Completion ${fpath})
autoload -Uz compinit
compinit

zstyle ':completion:*' matcher-list 'm:{a-z}={A-Z}'
zstyle ':completion:*:default' list-colors ${(s.:.)LS_COLORS}
zstyle ':completion:*:default' menu select true
zstyle ':completion:*' use-cache true
;;
esac

#stty -istrip
#stty erase '^\?'
#bindkey -m
bindkey -e
bindkey ";5C" forward-word
bindkey ";5D" backward-word

autoload -Uz url-quote-magic
zle -N self-insert url-quote-magic

alias a=alias
#a cd=" cd"
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

gd() {
    dirs -v
    echo -n "select number: "
    read newdir
    cd +"$newdir"
}

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

#-------------------------------------------------------------------------
# abbrev
#-------------------------------------------------------------------------
typeset -A myabbrev
myabbrev=(
'llv' '| lv'
'lg' '| grep'
'lx' '| xargs -r'
'0lx' '-print0 | xargs -0 -r'
'be' 'bundle exec'
)

my-expand-abbrev() {
    local left prefix
    left=$(echo -nE "$LBUFFER" | sed -e "s/[_a-zA-Z0-9]*$//")
    prefix=$(echo -nE "$LBUFFER" | sed -e "s/.*[^_a-zA-Z0-9]\([_a-zA-Z0-9]*\)$/\1/")
    LBUFFER=$left${myabbrev[$prefix]:-$prefix}" "
}
zle -N my-expand-abbrev
bindkey ' ' my-expand-abbrev

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
# term specific setting
#-------------------------------------------------------------------------
# if [ "$EMACS" = t -o "$TERM" = dumb ]; then
#     unsetopt zle
#     stty nl
#     unalias ls
#     a ls="ls -F"
#     PROMPT="`whoami`@%m%~%% "
#     unset RPROMPT
# fi

#-------------------------------------------------------------------------
# rbenv
#-------------------------------------------------------------------------
if [ -d "$HOME/.rbenv" ]; then
    export PATH="$HOME/.rbenv/bin:$PATH"
    eval "$(rbenv init -)"
    rehash () {
        rbenv rehash
        builtin rehash
    }
fi

#-------------------------------------------------------------------------
# local::lib
#-------------------------------------------------------------------------
eval $(perl -I ~/perl5/lib/perl5/ -Mlocal::lib)

#-------------------------------------------------------------------------
# z.sh - https://github.com/rupa/z.git
#-------------------------------------------------------------------------
test -e $HOME/z/z.sh && source $HOME/z/z.sh

#-------------------------------------------------------------------------
# Steam
#-------------------------------------------------------------------------
[[ -f "$HOME/.local/share/Steam/setup_debian_environment.sh" ]] && source "$HOME/.local/share/Steam/setup_debian_environment.sh"

#-------------------------------------------------------------------------
# Cygwin (bash|zsh) here
#-------------------------------------------------------------------------
if iscygwin; then
    if [ "$OPENDIR" != "" ]; then
        OPENDIR=`cygpath "$OPENDIR"`
        cd "$OPENDIR"
        unset OPENDIR
    fi
fi

#-------------------------------------------------------------------------
resume-ssh-agent
chpwd
