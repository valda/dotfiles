scriptencoding utf-8
set encoding=utf-8
set fileencodings=utf-8,cp932,euc-jp,iso-2022-jp
set fileformats=unix,dos,mac

set nocompatible
filetype plugin indent on
syntax on

set backspace=indent,eol,start
set incsearch
set ignorecase smartcase
set wrapscan
set laststatus=2
set statusline=%<%f\ %m%r%h%w%{'['.(&fenc!=''?&fenc:&enc).']['.&ff.']'}%=%l,%c%V%8P
set ambiwidth=double
set autoread
set backup
set backupdir=~/bak
set directory=~/tmp

set pastetoggle=<F2>

" IME制御
if executable('fcitx5-remote')
  augroup IMEControl
    autocmd!
    autocmd InsertLeave * :silent call system('fcitx5-remote -c')
    autocmd CmdlineLeave * :silent call system('fcitx5-remote -c')
  augroup END
endif
