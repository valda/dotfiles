## (*'-')/.zshenv

umask 022

#
# OS ¤ÇÊ¬´ô
#
case "$OSTYPE" in
    cygwin)
        export CYGWIN=acl
        export PATH=$HOME/bin:$HOME/opt/bin:$PATH
        export LANG=ja_JP.UTF-8
        export LANGUAGE=ja
        ;;
    *)
        limit coredumpsize 0
        export PATH=$HOME/bin:$HOME/opt/bin:$PATH
        export LANG=ja_JP.UTF-8
        export LANGUAGE=ja
        ;;
esac

if [ -z $USER ]
    then
    export USER=$LOGNAME
fi

export EDITOR=vi
export PAGER=lv
export BLOCKSIZE=K
export PERL_BADLANG=0
export PGPPATH=$HOME/.pgp
export NETHACKOPTIONS="noautopickup"
export GREP_COLOR="01;34"
export GREP_OPTIONS="--color=auto"
export LV='-Ou8 -c'
export TZ='JST-9'
export GISTY_DIR=$HOME/wc/gists
#export GST_TAG_ENCODING=CP932
export GST_ID3_TAG_ENCODING=CP932

if [ -x `which dircolors` ]
    then
    eval `dircolors -b`
fi

if [ -e $HOME/.zshenv.local ]; then
    source $HOME/.zshenv.local
fi
